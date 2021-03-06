var $tl, statusTemplate, targetTemplate, interfaceListTemplate;

function formatter(num, axis) {
    if (axis.max >= 1e9) {
        return (num / 1e9).toFixed(1) + 'G';
    } else if (axis.max >= 1e6) {
        return (num / 1e6).toFixed(1) + 'M';
    } else if (axis.max >= 1e3) {
        return (num / 1e3).toFixed(1) + 'k';
    } else {
        return num;
    }
    return val.toFixed(axis.tickDecimals);
}

function formatNumber(num) {
    if (num >= 1e9) {
        return (num / 1e9).toFixed(1) + 'G';
    } else if (num >= 1e6) {
        return (num / 1e6).toFixed(1) + 'M';
    } else if (num >= 1e3) {
        return (num / 1e3).toFixed(1) + 'k';
    } else {
        return num;
    }
}

function drawInGraph(id) {
    var draw = function (data) {
        var options = {
            series: {
                lines: { fill: true }
            },
            xaxis: { mode: "time" },
            yaxis: { tickFormatter: formatter },
            shadowSize: 0,
            legend: { position: 'nw' }
        };
        var ts = _.map(_.pluck(data, 't'), function (v) { return 1000 * v; });
        var vs = _.pluck(data, 'v');
        var iin = _.map(_.pluck(vs, 'ifInOctets'), function (v) { return 8 * v; });
        var iou = _.map(_.pluck(vs, 'ifOutOctets'), function (v) { return -8 * v; });
        var s1 = _.zip(ts, iin);
        var s2 = _.zip(ts, iou);
        var maxIn = formatNumber(_.max(iin));
        var maxOut = formatNumber(- _.min(iou));
        var series = [
            { label: 'In (max ' + maxIn + ')', data: s1, color: 'rgb(228, 26, 28)' },
            { label: 'Out (max ' + maxOut + ')', data: s2, color: 'rgb(55, 126, 184)' }
        ];
        jQuery.plot($(id), series, options);
    };
    return draw;
}

function simplify(str) {
    return str.replace(/[^a-zA-Z0-9-_]/g, '');
}

function showInterface(target, intf) {
    intf.id = simplify(intf.name);

    var tgt = encodeURIComponent(target.name);
    var int = encodeURIComponent(intf.name);
    jQuery.ajax('/data/' + tgt + '/' + int + '/7200/300').done(drawInGraph('#hourlyGraph'));
    jQuery.ajax('/data/' + tgt + '/' + int + '/86400/300').done(drawInGraph('#dailyGraph'));
    jQuery.ajax('/data/' + tgt + '/' + int + '/604800/300').done(drawInGraph('#weeklyGraph'));
    $('.selectedInterface').removeClass('selectedInterface');
    $('#interface-' + intf.id).addClass('selectedInterface');
};

var expandedTarget;
function showTarget(target, intf) {
    if (expandedTarget != target.name) {
        target.id = simplify(target.name);
        $('.selected').removeClass('selected');
        $('.interfaceList').remove();
        jQuery.ajax('/target/' + encodeURIComponent(target.name)).done(function (data) {
            for (var i = 0; i < data.interfaces.length; i++) {
                data.interfaces[i].id = simplify(data.interfaces[i].name);
            }
            var $elem = $(interfaceListTemplate({ target: target, interfaces: data.interfaces }));
            $('#target-' + target.id).addClass('selected').after($elem);

            if (intf) {
                showInterface(target, intf);
            }
        });
        expandedTarget = target.name;
    }
}

function parseHash() {
    var m = /^#([^/]+)\/?(.*)$/.exec(window.location.hash);
    if (m) {
        var tgt = {name: m[1]};
        var intf;
        if (m[2]) {
            intf = {name: m[2]};
        }

        if (expandedTarget !== tgt.name) {
            showTarget(tgt, intf);
        } else {
            showInterface(tgt, intf);
        }
    }
}

// Status updates

var latestStatusData;
function updateStatus() {
    jQuery.ajax('/status').done(function (data) {
        latestStatusData = data;
    });

    setTimeout(updateStatus, 5555);
}
var statusOptions = { series: { pie: { show: true, innerRadius: 0.6, label: { show: false }, stroke: { width: 0, color: '#888' } } }, legend: { show: false } }
function displayStatus() {
    if (latestStatusData) {
        _.each(latestStatusData, function (stat) {
            stat.duration = ((stat.end - stat.start) / 1000).toFixed(1);

            var $elem = $('#wait-' + stat.poller);
            if ($elem.length < 1) {
                $('#status').append($(statusTemplate(stat)));
                $elem = $('#wait-' + stat.poller);
            }

            var wait = Math.ceil((stat.next - Date.now()) / 1000);
            var waitColor = '#999';
            if (wait <= 0) {
                wait = 0;
                waitColor = '#ff9';
            }
            $.plot($elem, [ { color: '#fff', data: wait }, { color: waitColor, data: stat.poller-wait } ], statusOptions);
            $('#targets-' + stat.poller).text(stat.nhosts);
            $('#ncounters-' + stat.poller).text(stat.ncounters);
            $('#duration-' + stat.poller).text(stat.duration);
        });
    }

    setTimeout(displayStatus, 1000);
}

var graphsWidth;
function adjustWidths() {
    graphsWidth = graphsWidth || $('#graphs').width();
    var width = $(window).width();
    width -= graphsWidth;
    width -= 3 * 20; // margin
    $('#targets').css('width', width + 'px');
}

function filterTargets() {
    var f = $(this).val();
    $('.target').each(function (idx, elem) {
        var $elem = $(elem);
        if ($elem.attr('data-name').indexOf(f) >= 0) {
            $elem.show();
        } else {
            $elem.hide();
        }
    });
}

$(document).ready(function () {
    $tl = $('#targetList');
    statusTemplate = _.template(document.getElementById('statusTemplate').innerHTML);
    targetTemplate = _.template(document.getElementById('targetTemplate').innerHTML);
    interfaceListTemplate = _.template(document.getElementById('interfaceListTemplate').innerHTML);

    jQuery.ajax('/targets').done(function (data) {
        _.each(data, function (target) {
            target.id = simplify(target.name);
            var $elem = $(targetTemplate(target));
            $tl.append($elem);
        });
        parseHash();
    });

    $(window).bind('hashchange', parseHash);
    $(window).resize(adjustWidths);
    $('#targetFilter').keyup(filterTargets);

    _.defer(adjustWidths);
    _.defer(updateStatus);
    _.defer(displayStatus);
});

