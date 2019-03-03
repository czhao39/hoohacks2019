$(document).ready(function() {
    runAnimationSequence();
});

function runAnimationSequence() {
    $(".animation-group").velocity("transition.slideUpIn", {duration: 1000, stagger: 200})
}
