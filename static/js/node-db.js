
var NodeDBApp = {

    init: function() {
        console.log("node database web app started");
        this.table_template = _.template($('#table_template').html());

        this.test();
//        $('#testbtn').click(this.test.bind(this));
    },

    test: function() {

        var o = {type: 'node', id: '42', foo: 'bar'};

        $.ajax({
            type: 'POST',
            url: '/nodes',
            data: {
                data: JSON.stringify(o)
            }, 
            success: function(data) {
                console.log("Updated node: " + data);
            }
        });

        $.get('/nodes', function(resp_str) {
            var resp = JSON.parse(resp_str)
            console.log("Retrieved nodes: " + resp.data);

            var h = this.table_template({nodes: resp.data});
            $("#container").html(h);
        }.bind(this));
    }
};


$(document).ready(NodeDBApp.init.bind(NodeDBApp));