
var NodeDBApp = {

    init: function() {
        console.log("node database web app started");
    },

    test: function() {

        var o = {type: 'node', id: 42, foo: 'bar'};

        $.ajax({
            type: 'PUT',
            url: '/nodes/42', 
            data: {
                data: JSON.stringify(o)
            }, 
            success: function(data) {
                console.log("Updated node: " + data);
                $('#debug').html(data);
            }
        });

        $.get('/nodes/42', function(data) {
            console.log("Retrieved node: " + data);
            $('#debug').html(data);
        });
    }
};


$(document).ready(NodeDBApp.init);