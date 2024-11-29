const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

const dotenv = require("dotenv");
// Load environment variables
dotenv.config();
// API Key
const apiKey = process.env.API_KEY;

// Pass creator base path
const passCreatorBasePath = process.env.PASSCREATOR_BASE_PATH;

// Policy cards template id
const policyCardsTemplateId = process.env.POLICY_CARD_TEMPLATE_ID;

// Enable CORS for all routes
app.use(cors());

// Serve static files from the current directory
app.use(express.static(path.join(__dirname, "/public")));

// Serve index.html for the root route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/index.html"));
});

app.get("/api/passes/test", (req, res) => {
  res.sendFile(path.join(__dirname, "/data/simplified-data.json"));
});

app.get("/api/passes", async (req, res) => {
  try {
    const { startUid, startCreatedOnTimestamp } = req.query;

    let url = `${passCreatorBasePath}/api/v3/pass`;
    let params = {
      formatKeyAdditionalProperties: "name",
    };

    const bodyData = {
      filter: {
        query: {
          templateId: `${policyCardsTemplateId}`,
        },
        fields: ["createdOn", "numberOfActive", "identifier", "policyNumber"],
      },
    };

    // Add startUid and startCreatedOnTimestamp if they are present
    if (startUid) {
      params.startUid = startUid;
    }
    if (startCreatedOnTimestamp) {
      params.startCreatedOnTimestamp = startCreatedOnTimestamp;
    }

    const apiResponse = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `${apiKey}`,
      },
      params: params,
      data: bodyData,
    });

    res.json(apiResponse.data);
  } catch (error) {
    console.error("Error fetching pass data:", error);
    res.status(500).json({ error: "Failed to fetch pass data" });
  }
});

app.get("/api/passes/history", async (req, res) => {
  console.log("Calling /api/passes/history")
  try {
    let url = `${passCreatorBasePath}/api/pass/statistics/${policyCardsTemplateId}/activehistory`;

    const apiResponse = await axios.get(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `${apiKey}`,
      },
    });

    res.json(apiResponse.data);
  } catch (error) {
    console.error("Error fetching pass historic data:", error);
    res.status(500).json({ error: "Failed to fetch pass historic data" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
