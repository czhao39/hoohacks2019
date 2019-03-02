$(document).ready(function() {
    $("#event_id").keypress(function(e) {
        if (e.which == 13) {
            $("form#host_form").submit();
            return false;
        }
    });
});
