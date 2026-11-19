// Prototype helpers only. ?bare hides the prototype bar. #real switches the
// opening screens to the three-step track used by /l/{id}.
(function () {
  var b = document.body;
  if (/[?&]bare/.test(location.search)) b.classList.add("bare");
  if (location.hash === "#real") b.classList.add("real");
  var t = document.getElementById("track-toggle");
  if (t) t.addEventListener("click", function (e) {
    e.preventDefault();
    b.classList.toggle("real");
    history.replaceState(null, "", b.classList.contains("real") ? "#real" : location.pathname + location.search);
  });
})();
