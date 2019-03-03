$(document).ready(function() {
    $("#watch_form").submit(function(e) {
        e.preventDefault();
        var call_id = $("#event_id").val();
        if (call_id) {
            window.location.href = "/call/" + call_id + "?role=watch";
        }
    });

    $("#event_id").focus();
});
