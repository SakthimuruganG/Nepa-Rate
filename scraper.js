const axios = require("axios");
const cheerio = require("cheerio");
const ExcelJS = require("exceljs");
const fs = require("fs");
const sendMessage = require("./whatsapp");

const FILE = "egg_namakkal_table.xlsx";

// ---------- Helper to format NECC ----------
function formatNECCRate(raw) {
  if (!raw) return "";
  raw = raw.replace(/[^\d]/g, "");
  if (raw.length === 3) {
    return raw[0] + "." + raw.slice(1);
  }
  return raw;
}

// ---------- Fetch NEPA Rate ----------
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

// ---------- Fetch NECC Namakkal ----------
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
    }
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

// ---------- Write to Excel ----------
async function writeToExcel(date, nepaRate, neccRate) {
  const workbook = new ExcelJS.Workbook();
  let sheet;

  if (fs.existsSync(FILE)) {
    await workbook.xlsx.readFile(FILE);
    sheet = workbook.getWorksheet("Egg Rates");
  } else {
    sheet = workbook.addWorksheet("Egg Rates");

    sheet.columns = [
      { header: "Date", key: "date", width: 15 },
      { header: "Place", key: "place", width: 15 },
      { header: "NEPA Rate", key: "nepa", width: 15 },
      { header: "NECC Rate", key: "necc", width: 15 },
      { header: "Fetched At", key: "time", width: 25 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
  }

  // Check duplicate date
  let exists = false;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && row.getCell(1).value === date) {
      exists = true;
    }
  });

  if (exists) {
    console.log("⏭️ Today already exists in Excel");
    return;
  }

  sheet.addRow({
    date: date,
    place: "Namakkal",
    nepa: parseFloat(nepaRate),
    necc: parseFloat(neccRate),
    time: new Date().toISOString(),
  });

  await workbook.xlsx.writeFile(FILE);
  console.log("✅ Excel updated successfully");
}

// ---------- MAIN ----------
async function run() {
  try {
    console.log("Fetching NEPA...");
    const { date, nepaRate } = await getNEPARate();

    console.log("Fetching NECC...");
    const neccRate = await getNECCRate(date);

    await writeToExcel(date, nepaRate, neccRate);
    const message = `🥚 *Namakkal Egg Rate – ${date}*

NEPA Rate : ₹${nepaRate}
NECC Rate : ₹${neccRate}

Updated at: ${new Date().toLocaleTimeString()}`;

await sendMessage(message);

  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}

run();
