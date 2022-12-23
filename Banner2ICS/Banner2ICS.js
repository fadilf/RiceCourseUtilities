// Open the section to scrape
if ($("#scheduleDetailsViewLink").length) {
    $("#scheduleDetailsViewLink").click();
} else if ($("#newSummaryInfoLink").length) {
    $("#newSummaryInfoLink").click();
} else {
    alert("Try reloading the page and waiting a moment before using bookmarklet!");
}

// Check if courses can be loaded (courses been registered and load successfully)
let timeoutLength = 5; // (seconds)
let checksDone = 0;
let failed = null;
let scheduleCheck = setInterval(function(){
    if ($("#scheduleListView .listViewWrapper").length > 0) {
        scrape();
        clearInterval(scheduleCheck);
    }
    checksDone++;
    if (checksDone >= (timeoutLength * 10)) {
        alert("Failed to process (no courses or loading timed out).");
        clearInterval(scheduleCheck);
    }
}, 100);

// Start scraping each course
function scrape() {
    let courses = [];

    let courseNums = [];
    $('tbody [xe-field="subjectCourseSectionNumber"]').each(function(){
        courseNums.push($(this).text().split(",")[0]);
    });

    $("#scheduleListView .listViewWrapper").each(function(index){
        let course = {};
    
        // Easily scrapable info
        course["courseTitle"] = $(this).find(".section-details-link").text();
        course["courseCode"] = $(this).find(".list-view-subj-course-section").text();
        course["courseNum"] = courseNums[index];
    
        // Take raw html of section to parse meeting time info
        let courseMeetingsRaw = $(this).find(".listViewMeetingInformation");
        courseMeetingsRaw.each(function(){
            let meetings = []
            
            $(this).find(".meetingTimes").each(function(){
                meetings.push({
                    "dateRange": $(this).text().split(" -- ")
                });
            });
            
            $(this).find(".ui-pillbox-summary.screen-reader").each(function(index){
                meetings[index]["days"] = $(this).text().split(",");
            });
            
            $(this).find(".list-view-pillbox.ui-pillbox + span").each(function(index){
                meetings[index]["timeRange"] = $(this).text().replaceAll("  ", " ").trim().split(" - ");
            });
    
            // Parse each meeting time line
            let lines = $(this).html().split("<br>");
            lines.pop(); // Remove extraneous line
            lines.forEach((line, index) => {
                let el = document.createElement('html');
                el.innerHTML = line;
                let location = el.innerText.split("Building: ")[1].split(" Room: ");
                meetings[index]["location"] = location;
            });
            
            course["meetings"] = meetings;
        });
        courses.push(course);
    });

    // Generate ICS file
    $.getScript("https://cdn.statically.io/gh/nwcell/ics.js/dfec67f3/ics.min.js").done(function(){
        $.getScript("https://cdn.statically.io/gh/nwcell/ics.js/dfec67f3/ics.deps.min.js").done(function(){
            let cal = ics();
            const weekday = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

            // Add each course to calendar
            courses.forEach(course => {
                course["meetings"].forEach(meetingTime => {
                    let calTitle = `${course["courseNum"]}: ${course["courseTitle"]}`;
                    let calDescription = `${course["courseCode"]} | Building: ${meetingTime["location"][0]} | Room: ${meetingTime["location"][1]}`;
                    let calLocation = `${meetingTime["location"][0]}, Houston, TX`;
                    if (meetingTime["location"][0] == "None") {
                        calLocation = "None";
                    }

                    // Some "start dates" on Banner are actually delimiters and need to be adjusted accordingly
                    let startDate = new Date(meetingTime["dateRange"][0]);
                    while (!meetingTime["days"].includes(weekday[startDate.getDay()])) {
                        startDate.setDate(startDate.getDate() + 1);
                    }
                    startDate = startDate.toLocaleDateString("en-US");

                    let calFirstBegin = `${startDate} ${meetingTime["timeRange"][0]}`;
                    let calFirstEnd = `${startDate} ${meetingTime["timeRange"][1]}`;
                    let calRRule = {
                        freq: "WEEKLY",
                        until: meetingTime["dateRange"][1],
                        interval: 1,
                        byday: meetingTime["days"].map(day => day.slice(0, 2).toUpperCase())
                    };
                    cal.addEvent(calTitle, calDescription, calLocation, calFirstBegin, calFirstEnd, calRRule);
                });
            });

            // Download calendar file with semester name
            cal.download($(".schedule-list-view-title-text").text().slice(19).replaceAll(" ", ""));
        });
    });
}