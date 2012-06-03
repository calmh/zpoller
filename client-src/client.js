var $tl, statusTemplate, targetTemplate, interfaceListTemplate;

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
    $('.selectedInterface').removeClass('selectedInterface');
    $('#interface-' + intf.name).addClass('selectedInterface');
};

var expandedTarget;
function showTarget(target) {
    if (expandedTarget != target.name) {
        $('.selected').removeClass('selected');
        $('.interfaceList').remove();
        jQuery.ajax(host + '/target/' + encodeURIComponent(target.name)).done(function (data) {
            var $elem = $(interfaceListTemplate({ target: target, interfaces: data.interfaces }));
            $('#target-' + target.name).addClass('selected').after($elem);
        });
        expandedTarget = target.name;
    }
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

    jQuery.ajax(host + '/targets').done(function (data) {
        _.each(data, function (target) {
            var $elem = $(targetTemplate(target));
            $tl.append($elem);
        });
        parseHash();
    });

    updateStatus();
    displayStatus();

    $(window).bind('hashchange', parseHash);
});

