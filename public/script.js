let chart;
let allPassData = [];
let totalInactivePasses = 0;
let totalActivePasses = 0;
let defaultTimeFrame = "day";
let defaultStartDate = new Date();
defaultStartDate.setMonth(defaultStartDate.getMonth() - 1); // Default to 1 month ago
let defaultEndDate = new Date(); // Today
let selectedCountry = "Germany"; // To store the selected country
let demoMode = true;
const activePassesContainer = document.getElementById(
  "stats-container"
);

async function fetchPassStatistics() {
  try {
    const cachedMostRecentHistoryData = localStorage.getItem(
      "mostRecentHistoryData"
    );

    if (cachedMostRecentHistoryData) {
      return;
    }

    const response = await fetch("/api/passes/history");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const jsonResponse = await response.json();

    const mostRecentHistoryData = jsonResponse.reduce((latest, current) => {
      return new Date(current.date) > new Date(latest.date) ? current : latest;
    });

    localStorage.setItem(
      "mostRecentHistoryData",
      JSON.stringify(mostRecentHistoryData)
    );
  } catch (error) {
    console.error("Error fetching pass statistics:", error);
  }
}

async function fetchAllPassData() {
  let allData = [];
  let nextPageUrl = "/api/passes";
  let startUid = "";
  let startCreatedOnTimestamp = null;
  let pageCount = 0;
  const MAX_PAGES = 5; // Limit to 5 pages for safety

  do {
    try {
      const response = await fetch(nextPageUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const jsonData = await response.json();
      allData = allData.concat(jsonData.data);

      if (jsonData.page && jsonData.page.next) {
        const nextUrl = new URL(jsonData.page.next);
        startUid = nextUrl.searchParams.get("startUid");
        startCreatedOnTimestamp = nextUrl.searchParams.get(
          "startCreatedOnTimestamp"
        );
        nextPageUrl = `http://localhost:3001/api/passes?startUid=${startUid}&startCreatedOnTimestamp=${startCreatedOnTimestamp}`;
      } else {
        nextPageUrl = null;
      }

      pageCount++;
    } catch (error) {
      console.error("Error fetching pass data:", error);
      break;
    }
  } while (nextPageUrl && pageCount < MAX_PAGES);

  allPassData = allData;
}

async function fetchDemoPassData() {
  try {
    const cachedData = localStorage.getItem("demoPassData");
    if (cachedData) {
      console.log("demoPassData is cached returning");
      allPassData = JSON.parse(cachedData);
      return;
    }
    const response = await fetch("/api/passes/test");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const jsonResponse = await response.json();
    allPassData = jsonResponse.data; // Store this globally
    console.log("fetchDemoPassData:: allPassData = ,", allPassData);
    localStorage.setItem("demoPassData", JSON.stringify(allPassData));
  } catch (error) {
    console.error("Error processing pass data:", error);
  }
}

async function fetchAndRenderData() {
  console.log("Demo mode ", demoMode);
  if (demoMode) {
    await fetchDemoPassData();
  } else {
    await fetchPassStatistics();
    await fetchAllPassData();
  }
}

function aggregateData(
  timeFrame,
  startDate,
  endDate,
  dataToAggregate = allPassData
) {
  const aggregatedData = {};

  dataToAggregate.forEach((pass) => {
    const createdOn = new Date(pass.createdOn);

    if (createdOn >= startDate && createdOn <= endDate) {
      let key;
      switch (timeFrame) {
        case "day":
          key = createdOn.toISOString().split("T")[0];
          break;
        case "month":
          key = `${createdOn.getFullYear()}-${(createdOn.getMonth() + 1)
            .toString()
            .padStart(2, "0")}`;
          break;
        case "year":
          key = createdOn.getFullYear().toString();
          break;
      }

      if (pass.numberOfActive === 1) {
        aggregatedData[key] = (aggregatedData[key] || 0) + 1;
      }
    }
  });

  return aggregatedData;
}

function renderChart(labels, data) {
  const ctx = document.getElementById("activePassesChart").getContext("2d");

  // Destroy existing chart if it exists
  if (window.myChart instanceof Chart) {
    window.myChart.destroy();
  }

  window.myChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Number of Active Passes",
          data: data,
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

function updateTotalPassesCounter(activePasses, inactivePasses) {
  if (demoMode) {
    totalActivePasses = activePasses.length;
    totalInactivePasses = inactivePasses.length;
  } else {
    const cachedMostRecentHistoryData = localStorage.getItem(
      "mostRecentHistoryData"
    );
    const cachedHistoricData = JSON.parse(cachedMostRecentHistoryData);
    totalActivePasses = cachedHistoricData.active;
    totalInactivePasses = cachedHistoricData.inactive;
  }

  document.getElementById("active-passes-number").textContent =
    totalActivePasses;
  document.getElementById("inactive-passes-number").textContent =
    totalInactivePasses;
}

function updateChart() {
  const timeFrame = document.getElementById("timeFrameSelector").value || "day";
  const dateRangeInput = document.getElementById("dateRangePicker").value;

  let startDate, endDate;
  if (dateRangeInput) {
    const [start, end] = dateRangeInput.split(" to ").map((d) => new Date(d));
    startDate = start;
    endDate = end;
  } else {
    endDate = new Date(); // Today
    startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - 1); // Default to 1 month ago
  }

  const { activePasses, inactivePasses } = filterActivePassesByCountry(
    allPassData,
    selectedCountry
  );

  updateTotalPassesCounter(activePasses, inactivePasses);

  const aggregatedData = aggregateData(
    timeFrame,
    startDate,
    endDate,
    activePasses
  );
  let totalPassCount = 0;
  Object.values(aggregatedData).forEach((activePassesPerDay) => {
    totalPassCount += activePassesPerDay;
  });
  document.getElementById("active-passes-timerange-number").textContent =
    totalPassCount;

  const sortedData = sortDataByDate(aggregatedData, timeFrame);
  const labels = sortedData.map(([date, _]) => date);
  const dataPoints = sortedData.map(([_, count]) => count);

  renderChart(labels, dataPoints);
}

function filterActivePassesByCountry(data, country) {
  let activePasses = [];
  let inactivePasses = [];

  if (country === "Germany") {
    data.forEach((pass) => {
      if (pass.policyNumber && pass.policyNumber.startsWith("DG")) {
        if (pass.numberOfActive >= 1) {
          activePasses.push(pass);
        } else {
          inactivePasses.push(pass);
        }
      }
    });
  } else if (country === "Netherlands") {
    data.forEach((pass) => {
      if (pass.policyNumber && pass.policyNumber.startsWith("DN")) {
        if (pass.numberOfActive >= 1) {
          activePasses.push(pass);
        } else {
          inactivePasses.push(pass);
        }
      }
    });
  } else {
    data.forEach((pass) => {
      if (pass.numberOfActive >= 1) {
        activePasses.push(pass);
      } else {
        inactivePasses.push(pass);
      }
    });
  }

  return { activePasses, inactivePasses };
}

const modeToggle = document.getElementById("mode-toggle");
const spinner = document.querySelector('.spinner');
modeToggle.addEventListener("change", function () {
  demoMode = !this.checked;

  if (demoMode) {
    activePassesContainer.classList.remove("loading");
    spinner.style.display = 'none'; // Remove the spinner
  } else {
    activePassesContainer.classList.add("loading");
    spinner.style.display = 'block'; // Show the spinner
  }

  fetchAndRenderData().then(() => {
    spinner.style.display = 'none';
    activePassesContainer.classList.remove("loading");
    updateChart();
  });
});

document.addEventListener("DOMContentLoaded", () => {
  localStorage.clear();
  modeToggle.checked = !demoMode;

  flatpickr("#dateRangePicker", {
    mode: "range",
    dateFormat: "Y-m-d",
    defaultDate: [new Date().setMonth(new Date().getMonth() - 1), new Date()],
    onChange: updateChart,
  });

  document
    .getElementById("timeFrameSelector")
    .addEventListener("change", updateChart);

  // Initialize with Germany flag by default
  document.getElementById("selected-flag-icon").innerHTML = `
    <img
      src="https://flagcdn.com/w320/de.png"
      alt="Germany Flag"
      width="24"
      height="16"
    />
  `;

  const germanyFilter = document.getElementById("germany-filter");
  germanyFilter.addEventListener("click", () => {
    selectedCountry = "Germany";
    document.getElementById("selected-flag-icon").innerHTML = `
      <img
        src="https://flagcdn.com/w320/de.png"
        alt="Germany Flag"
        width="24"
        height="16"
      />
    `;
    updateChart();
  });

  const netherlandsFilter = document.getElementById("netherlands-filter");
  netherlandsFilter.addEventListener("click", () => {
    selectedCountry = "Netherlands";
    document.getElementById("selected-flag-icon").innerHTML = `
      <img
        src="https://flagcdn.com/w320/nl.png"
        alt="Netherlands Flag"
        width="24"
        height="16"
      />
    `;

    updateChart();
  });

  document
    .getElementById("selected-flag-icon")
    .addEventListener("click", () => {
      if (selectedCountry === "Germany") {
        // Switch to Netherlands
        selectedCountry = "Netherlands";
        document.getElementById("selected-flag-icon").innerHTML = `
      <img
        src="https://flagcdn.com/w320/nl.png"
        alt="Netherlands Flag"
        width="24"
        height="16"
      />
    `;
      } else {
        // Switch to Germany
        selectedCountry = "Germany";
        document.getElementById("selected-flag-icon").innerHTML = `
      <img
        src="https://flagcdn.com/w320/de.png"
        alt="Germany Flag"
        width="24"
        height="16"
      />
    `;
      }
      updateChart();
    });

  fetchAndRenderData().then(() => {
    updateChart();
  });
});

function sortDataByDate(data, timeFrame) {
  return Object.entries(data).sort((a, b) => {
    const dateA = new Date(timeFrame === "year" ? `${a[0]}-01-01` : a[0]);
    const dateB = new Date(timeFrame === "year" ? `${b[0]}-01-01` : b[0]);
    return dateA - dateB;
  });
}
