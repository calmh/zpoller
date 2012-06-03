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
    jQuery.ajax('/data/' + tgt + '/' + int + '/7200').done(drawInGraph('#hourlyGraph'));
    jQuery.ajax('/data/' + tgt + '/' + int + '/86400').done(drawInGraph('#dailyGraph'));
    $('.selectedInterface').removeClass('selectedInterface');
    $('#interface-' + intf.id).addClass('selectedInterface');
};

var expandedTarget;
function showTarget(target) {
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
        });
        expandedTarget = target.name;
    }
}

// Status updates

var latestStatusData;
function updateStatus() {
    jQuery.ajax('/status').done(function (data) {
        latestStatusData = data;
    });

    setTimeout(updateStatus, 10000);
}
function displayStatus() {
    if (latestStatusData) {
        $('#status').empty();
        _.each(latestStatusData, function (stat) {
            stat.duration = ((stat.end - stat.start) / 1000).toFixed(1);
            var html = statusTemplate(stat);
            var elem = $(html);
            $('#status').append(elem);
        });
    }

    setTimeout(displayStatus, 1000);
}

function parseHash() {
    var m = /^#([^/]+)\/?(.*)$/.exec(window.location.hash);
    if (m) {
        showTarget({name: m[1]});
        if (m[2]) {
            showInterface({name: m[1]}, {name: m[2]});
        }
    }
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

    updateStatus();
    displayStatus();

    $(window).bind('hashchange', parseHash);
});

