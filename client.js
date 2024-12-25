$(function () {
  const formatter = new Intl.DateTimeFormat("nl", { month: "long" });
  const month1 = formatter.format(new Date());
  var startTime = 0;
  var stopTime = 0;

  var socket = io();
  socket.on("hideShadow", function (message) {
    $("#top2000-id-square-shadow-1").addClass("hidden");
    $("#top2000-id-square-shadow-1").addClass("hidden");
  });
  var currentPosition = -1;

  socket.on("new song", function (msg) {
    console.log(msg);
    if (
      msg.currentSong.position &&
      msg.currentSong.position.current !== currentPosition
    ) {
      $("#huge-id").html(msg.currentSong.position.current);

      $("#main-view").addClass("id-flash");

      setTimeout(function () {
        $("#main-view").removeClass("id-flash");
      }, 3000);
    }
    $("#main-view").removeClass("notification-shown");

    setTimeout(function () {
      $("#current-song-artist").html(
        msg.currentSong.track
          ? msg.currentSong.track.artist
          : msg.currentSong.artist
      );
      $("#current-song-title").html(
        addNonBoldSpan(
          msg.currentSong.track
            ? msg.currentSong.track.title
            : msg.currentSong.title
        )
      );
      $("#current-song-votes").html(createVotesText(msg.currentSong));
      if (msg.currentSong.position) {
        $("#top2000-id").html(msg.currentSong.position.current);
      } else {
        $("#top2000-id").html("");
      }

      if (msg.currentSong.year) {
        $("#current-song-year").html(msg.currentSong.year);
      } else {
        $("#current-song-year").html("");
      }

      if (msg.currentSong.position) {
        var difference =
          msg.currentSong.position.current - msg.currentSong.position.previous;
        if (msg.currentSong.position.previous === 0) {
          // $("#current-song-difference").html("&#9644;");
          $("#current-song-difference").html(
            '<img class="svg" src="ui-arrow-solid-new-blue.svg">'
          );
        } else if (difference > 0) {
          $("#current-song-difference").html("&#9652; " + difference);
        } else if (difference < 0) {
          $("#current-song-difference").html("&#9662; " + -difference);
        } else {
          $("#current-song-difference").html("&#9644; 0");
        }
      } else {
        $("#current-song-difference").html("");
      }

      startTime = msg.currentSong.startTime;
      stopTime = msg.currentSong.stopTime;

      if (msg.previousSong) {
        $("#previous-song-artist").html(
          msg.previousSong.track
            ? msg.previousSong.track.artist
            : msg.previousSong.artist
        );
        $("#previous-song-title").html(
          addNonBoldSpan(
            msg.previousSong.track
              ? msg.previousSong.track.title
              : msg.previousSong.title
          )
        );
        $("#previous-song-votes").html(createVotesText(msg.previousSong));
        $("#previous-id").html(
          msg.previousSong.position ? msg.previousSong.position.current : ""
        );
      } else {
        $("#previous-song-artist").html("");
        $("#previous-song-title").html("");
        $("#previous-song-votes").html("");
        $("#previous-id").html("");
      }

      if (msg.nextSong) {
        $("#next-song-artist").html(
          msg.nextSong.track ? msg.nextSong.track.artist : msg.nextSong.artist
        );
        $("#next-song-title").html(
          addNonBoldSpan(
            msg.nextSong.track ? msg.nextSong.track.title : msg.nextSong.title
          )
        );
        $("#next-song-votes").html(createVotesText(msg.nextSong));
        $("#next-id").html(
          msg.nextSong.position && msg.nextSong.position.current
        );
      } else {
        $("#next-song-artist").html("");
        $("#next-song-title").html("");
        $("#next-song-votes").html("");
        $("#next-id").html("");
      }
      if (
        msg.currentSong.position &&
        msg.currentSong.position.current !== currentPosition
      ) {
        currentPosition = msg.currentSong.position.current;
        $("#main-view").addClass("song-detail");
      }
      if (msg.currentSong.startTime && msg.currentSong.stopTime) {
        updateProgressBar();
        $("#progress-bar").css("opacity", 1);
      } else {
        $("#progress-bar").css("opacity", 0);
      }
    }, 1000);

    if (
      msg.currentSong.position &&
      msg.currentSong.position.current !== currentPosition
    ) {
      setTimeout(function () {
        $("#main-view").removeClass("song-detail");
      }, 10000);
    }
  });
  setInterval(updateProgressBar, 0.5);

  socket.on("error", function (message) {
    $("#main-view").addClass("notification-shown");
    $("#notification").html(
      "De verbinding is verbroken ...<br><span class='notification-message'>" +
        message +
        "</span>"
    );
  });
  socket.on("editionSlogan", function (notification) {
    // $('#main-view').addClass('notification-shown');
    $("#topright")
      .html("<span>" + notification + "</span>")
      .delay(10000)
      .fadeOut("slow");
  });

  function createVotesText(song) {
    if (!song.voters) {
      return "";
    }
    votesHtml = "";
    for (var i = 0; i < song.voters.length; i++) {
      votesHtml += '<div class="vote-badge">' + song.voters[i] + "</div>";
    }
    return votesHtml;
  }

  function updateProgressBar() {
    var fraction =
      (100 * (new Date().getTime() - startTime)) / (stopTime - startTime);
    if (fraction > 100) {
      fraction = 100;
      $("#progress-bar").css("opacity", 0);
    }
    if (fraction < 0) {
      fraction = 0;
      $("#progress-bar").css("opacity", 0);
    }
    $("#progress-bar-fill").css("width", fraction + "%");
    $("#progress-bar-knob").css("left", fraction + "%");
  }

  socket.on("hour overview", function (msg) {
    $("#hour-overview").addClass("visible");
    $("#hour-overview-header").html(
      "<b>" +
        msg.date +
        " " +
        month1 +
        " " +
        msg.hour +
        ":00&nbsp;&nbsp;&nbsp;&nbsp; uur " +
        msg.hourCount +
        "/" +
        msg.hoursTotal +
        "</b><br>" +
        msg.presenter
    );
    $("#hour-overview-body").html("");
    for (var i = 0; i < msg.songs.length; i++) {
      var s = msg.songs[i];
      var difference =
        msg.songs[i].position.previous - msg.songs[i].position.current;
      if (msg.songs[i].position.previous === 0) {
        var diffString = '<div class="hour-overview-diff new">&#9644;</div>';
      } else if (difference > 0) {
        var diffString =
          '<div class="hour-overview-diff climbs">' + difference + "</div>";
      } else if (difference < 0) {
        var diffString =
          '<div class="hour-overview-diff descends">' + -difference + "</div>";
      } else {
        var diffString = '<div class="hour-overview-diff equal">=</div>';
      }
      let votesString = "";
      for (let i = 0; i < s["voters"].length; i++) {
        votesString += ' <div class="vote-badge">' + s["voters"][i] + "</div>";
      }
      $("#hour-overview-body").append(
        '<div class="hour-overview-song"><div class="hour-overview-id">' +
          (s.position && s.position.current) +
          "</div>" +
          diffString +
          '<div class="hour-overview-title"><b>' +
          addNonBoldSpan(s.track ? s.track.title : s.title) +
          "</b>" +
          votesString +
          '<br><span class="non-bold">' +
          (s.track ? s.track.artist : s.artist) +
          "</span></div></div>"
      );
    }
    // 2 minutes and 2 seconds (to allow the ID flash of the next song to be shown)
    setTimeout(function () {
      $("#hour-overview").removeClass("visible");
      clearTimeout(nextScrollTimer);
    }, 362000);
    startHourOverviewScroll();
  });

  setInterval(updateClock, 1000);

  function updateClock() {
    let date = new Date();
    // show clock only on 31 December or 1 Jan
    if (
      !(
        (date.getMonth() === 11 &&
          date.getDate() === 31 &&
          date.getHours() >= 12) ||
        (date.getMonth() === 0 &&
          date.getDate() === 1 &&
          date.getHours() === 0 &&
          date.getMinutes() < 15)
      )
    ) {
      $("#clock").toggleClass("visible", false);
      return;
    }
    $("#clock-timer").html(
      date.getHours() +
        ":" +
        (date.getMinutes() < 10 ? "0" : "") +
        date.getMinutes() +
        ":" +
        (date.getSeconds() < 10 ? "0" : "") +
        date.getSeconds()
    );
    $("#clock-image").attr("src", "timezones/" + date.getHours() + ".png");

    let showClock = false;
    // show clock around each hour
    if (date.getMinutes() === 59 && date.getSeconds() > 50) {
      showClock = true;
    }
    if (date.getMinutes() === 0 && date.getSeconds() < 20) {
      showClock = true;
    }
    // also show it after New Year
    if (
      date.getHours() === 23 &&
      date.getMinutes() === 56 &&
      date.getSeconds() > 0
    ) {
      showClock = true;
    }
    if (date.getMonth() === 0) {
      showClock = true;
    }
    $("#clock").toggleClass("visible", showClock);
  }

  function addNonBoldSpan(text) {
    return text.replace(/\([^)]*\)/, '<span class="non-bold">$&</span>');
  }

  let nextScrollTimer;

  function startHourOverviewScroll() {
    let $list = $("#hour-overview-body");
    $list.scrollTop(0);
    $list.removeClass("hidden");
    $list.height("auto");

    let availableSpace = $("body").height() - $list.offset().top;
    let scrollDistance = $list.height() - availableSpace;

    $list.height(availableSpace);

    // durations
    let waitDuration = 5000;
    let scrollDuration = scrollDistance * 25;

    // do the animations
    setTimeout(function () {
      $list.animate(
        {
          scrollTop: scrollDistance,
        },
        {
          duration: scrollDuration,
          easing: "linear",
        }
      );
    }, waitDuration);

    setTimeout(function () {
      $list.addClass("hidden");
    }, 2 * waitDuration + scrollDuration);
    setTimeout(function () {
      $list.scrollTop(0);
    }, 2 * waitDuration + scrollDuration + 550);

    // recursive call to do the next scroll
    nextScrollTimer = setTimeout(
      startHourOverviewScroll,
      2 * waitDuration + scrollDuration + 600
    );
  }
});
$("#notification").click(function () {
  $("#notification").removeClass("notification-shown");
  $("#notification").addClass("notification-hidden");
});
