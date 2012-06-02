var $tl, $il, $gr, statusTemplate;

var host = 'http://localhost:8080';

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
                lines: { steps: true, fill: true }
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
        jQuery.plot($(id), [ { label: 'In (max ' + maxIn + ')', data: s1 }, { label: 'Out (max ' + maxOut + ')', data: s2 } ], options);
    };
    return draw;
}

function showInterface(target, intf) {
    var tgt = encodeURIComponent(target.name);
    var int = encodeURIComponent(intf.name);
    jQuery.ajax(host + '/data/' + tgt + '/' + int + '/7200')
    .done(drawInGraph('#hourlyGraph'));
    jQuery.ajax(host + '/data/' + tgt + '/' + int + '/86400')
    .done(drawInGraph('#dailyGraph'));
};

function showTarget(target) {
    $il.empty();
    jQuery.ajax(host + '/target/' + encodeURIComponent(target.name)).done(function (data) {
        _.each(data.interfaces, function (intf) {
            $('#interfaceHeader').html(target.name);
            var $li = $('<li></li>');
            var $a = $('<a>' + intf.name + '</a>');
            $a.attr('href', '#' + target.name + '/' + intf.name);
            $a.addClass('interfaceName');
            $a.click(function () {
                showInterface(target, intf);
            });
            $li.append($a);
            $li.append('<br />');

            _.each(_.keys(intf.metadata).sort(), function (k) {
                var v = intf.metadata[k];
                if (v && v !== intf.name) {
                    if (_.isNumber(v)) {
                        v = formatNumber(v);
                    }
                    $li.append('<span class="interfaceMeta">' + k + ': ' + v + '</span><br />');
                }
            });
            $il.append($li);
        });
    });
}

// Status updates

var latestStatusData;
function updateStatus() {
    jQuery.ajax(host + '/status').done(function (data) {
        latestStatusData = data;
    });

    setTimeout(updateStatus, 10000);
}
function displayStatus() {
    if (latestStatusData) {
        $('#status').empty();
        _.each(latestStatusData, function (stat) {
            var html = statusTemplate(stat);
            var elem = $(html);
            $('#status').append(elem);
        });
    }

    setTimeout(displayStatus, 1000);
}

$(document).ready(function () {
    $tl = $('#targetList');
    $il = $('#interfaceList');
    $gr = $('#graphs');
    statusTemplate = _.template(document.getElementById('statusTemplate').innerHTML);

    jQuery.ajax(host + '/targets').done(function (data) {
        _.each(data, function (target) {
            var $li = $('<li></li>').addClass('target');
            var $a = $('<a>' + target.name + '</a>')
            .attr('href', '#' + target.name)
            .click(function () {
                showTarget(target);
            });
            $li.append($a);
            $li.append('<br />');
            $li.append('<span class="targetMeta">ip: ' + target.ip + '</span><br />');
            $tl.append($li);
        });
    });

    var m = /^#([^/]+)\/(.+)$/.exec(window.location.hash);
    if (m) {
        showTarget({name: m[1]});
        showInterface({name: m[1]}, {name: m[2]});
    }

    updateStatus();
    displayStatus();
});

