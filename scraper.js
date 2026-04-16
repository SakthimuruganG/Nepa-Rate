const axios = require("axios");
const cheerio = require("cheerio");
require("dotenv").config();
const twilio = require("twilio");
const fs = require("fs");
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);
const cron = require("node-cron");


function formatNECCRate(raw) {
  if (!raw) return "";
  raw = raw.replace(/[^\d]/g, "");
  if (raw.length === 3) {
    return raw[0] + "." + raw.slice(1);
  }
  return raw;
}


async function getNEPARate() {
  const url =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRBg-MTLTITO1TnYddC0Q_U7iC3DymagcyDxWmkfAZSZUT0YtCiR8lLZLh8DiTZkzhlsosm05A28ptI/pub?gid=0&single=true&output=csv";

  const response = await axios.get(url);
  const lines = response.data.split("\n");

  let date = "";
  let rate = "";

  for (let line of lines) {
    if (line.includes("Date:")) {
      date = line.split(",")[1].trim().split(" ")[0];
    }
    if (line.includes("Egg rate")) {
      const match = line.match(/₹\s*([\d.]+)/);
      if (match) rate = match[1];
    }
  }

  return { date, nepaRate: rate };
}


async function getNECCRate(dateStr) {
  const [day, month, year] = dateStr.split(".");

  const response = await axios.post(
    "https://www.e2necc.com/home/eggprice",
    `ddlMonth=${month}&ddlYear=${year}&rblReportType=DailyReport&btnReport=Get+Sheet`,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
      },
    },
  );

  const $ = cheerio.load(response.data);
  let rawRate = "";

  $("table tr").each((i, row) => {
    const cells = $(row).find("td");
    if (cells.length > 0) {
      const zone = $(cells[0]).text().trim();
      if (zone.includes("Namakkal")) {
        rawRate = $(cells[parseInt(day)]).text().trim();
      }
    }
  });

  return formatNECCRate(rawRate);
}

async function run() {
  try {
    console.log("Fetching NEPA...");
    const { date, nepaRate } = await getNEPARate();

    console.log("Fetching NECC...");
    const neccRate = await getNECCRate(date);

    const message = `Namakkal Egg Rate - ${date}

NEPA Rate: ₹${nepaRate}
NECC Rate: ₹${neccRate}

Updated: ${new Date().toLocaleTimeString()}`;

    console.log("Sending SMS...");

    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: process.env.TO_PHONE,
    });

    console.log("✅ SMS sent successfully!");
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

cron.schedule("0 9 * * *", () => {
  run(); 
});
