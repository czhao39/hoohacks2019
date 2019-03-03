$(document).ready(function() {
    $("#watch_form").submit(function(e) {
        e.preventDefault();
        var call_id = $("#event_id").val();
        if (call_id) {
            $.get("/check?room=" + encodeURIComponent(call_id), function(data) {
                if (data.exists) {
                    window.location.href = "/call/" + call_id + "?role=watch";
                }
                else {
                    M.toast({html: "No session exists with that event ID!"});
                }
            });
        }
    });

    $("#event_id").focus();
});
