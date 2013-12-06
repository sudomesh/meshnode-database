
var NodeDBApp = {

    init: function() {
        console.log("node database web app started");
    },

    test: function() {
        $.get('/nodes/42', function(data) {
            console.log("Got response: " + data);
            $('#debug').html(data);
        });
    }
};


$(document).ready(NodeDBApp.init);