/**
 * MMT Sync — Resilient iRacing SessionInfo YAML Parser
 * Zero external dependencies. Sanitizes non-ASCII characters, quotes, and escaped sequences.
 */

import type { Driver, SessionInfoState, SessionResultPosition, WeekendInfo } from "./types";

/**
 * Sanitizes arbitrary strings from iRacing YAML (unescapes unicode, strips outer quotes, normalizes spaces)
 */
export function sanitizeYamlString(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();
  // Strip outer matching quotes
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  // Replace escaped quotes and backslashes
  s = s.replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  // Clean null bytes or control characters except standard whitespace
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return s.trim();
}

/**
 * Formats hex color string (e.g. 0xffffff or 16777215) to valid CSS hex #xxxxxx
 */
export function parseColor(raw: string | number): string {
  if (typeof raw === "number") {
    return `#${(raw & 0xffffff).toString(16).padStart(6, "0")}`;
  }
  const clean = String(raw || "").trim().toLowerCase();
  if (clean.startsWith("0x")) {
    const num = parseInt(clean.slice(2), 16);
    return isNaN(num) ? "#ffffff" : `#${(num & 0xffffff).toString(16).padStart(6, "0")}`;
  }
  if (clean.startsWith("#")) return clean;
  const num = parseInt(clean, 10);
  return isNaN(num) ? "#38bdf8" : `#${(num & 0xffffff).toString(16).padStart(6, "0")}`;
}

/**
 * Maps license letter to color
 */
export function getLicenseColor(licString: string): string {
  const first = (licString || "").trim().toUpperCase().charAt(0);
  switch (first) {
    case "R": return "#dc2626"; // Red
    case "D": return "#ea580c"; // Orange
    case "C": return "#eab308"; // Yellow
    case "B": return "#16a34a"; // Green
    case "A": return "#0284c7"; // Blue
    case "P": return "#111827"; // Pro (Black)
    default: return "#64748b";  // Gray
  }
}

/**
 * Parses DriverInfo.Drivers and WeekendInfo from iRacing SessionInfo YAML
 */
export function parseSessionInfoYaml(yamlText: string, updateNum: number = 0): SessionInfoState {
  const drivers: Record<number, Driver> = {};
  let driverCarEstLapTime = 90.0;
  let driverCarIdx = 0;

  const weekendInfo: WeekendInfo = {
    trackName: "Unknown",
    trackConfigName: "",
    trackId: 0,
    trackLengthM: 4500,
    category: "Road",
    sessionType: "Practice",
  };

  if (!yamlText || yamlText.length < 32) {
    return {
      update: updateNum,
      weekendInfo,
      driverInfo: { drivers, driverCarEstLapTime, driverCarIdx },
      sessionType: "Practice",
      sessionNum: 0,
    };
  }

  const lines = yamlText.split(/\r?\n/);
  let currentSection = "";
  let inDriversList = false;
  let currentDriver: Partial<Driver> | null = null;
  let sessionType = "Practice";
  let sessionNum = 0;
  const sectors: Array<{ sectorNum: number; startPct: number }> = [];
  let currentSectorNum: number | null = null;
  const sessionResults: Record<number, Record<number, SessionResultPosition>> = {};
  let currentSessNum = 0;
  let inResultsPositions = false;
  let currentResult: Partial<SessionResultPosition> | null = null;

  const commitResult = () => {
    if (!currentResult || currentResult.carIdx === undefined || currentResult.carIdx < 0 || currentResult.carIdx > 63) {
      currentResult = null;
      return;
    }
    if (!sessionResults[currentSessNum]) sessionResults[currentSessNum] = {};
    sessionResults[currentSessNum][currentResult.carIdx] = {
      carIdx: currentResult.carIdx,
      position: currentResult.position || 0,
      classPosition: currentResult.classPosition || 0,
      fastestTime: currentResult.fastestTime && currentResult.fastestTime > 0 ? currentResult.fastestTime : 0,
      lastTime: currentResult.lastTime && currentResult.lastTime > 0 ? currentResult.lastTime : 0,
      lapsComplete: currentResult.lapsComplete || 0,
      timeGap: currentResult.timeGap && currentResult.timeGap > 0 ? currentResult.timeGap : 0,
    };
    currentResult = null;
  };

  const commitDriver = () => {
    if (!currentDriver || currentDriver.carIdx === undefined) return;
    // Filter Pace Car and Spectators strictly per SDK specs
    if (currentDriver.isPaceCar || currentDriver.isSpectator) return;
    if (currentDriver.carIdx < 0 || currentDriver.carIdx > 63) return;

    const carIdx = currentDriver.carIdx;
    const licStr = currentDriver.licString || "R 0.0";
    const carPath = (currentDriver.carPath || "unknown").toLowerCase();

    drivers[carIdx] = {
      carIdx,
      userName: currentDriver.userName || `Piloto #${currentDriver.carNumber || carIdx}`,
      abbrevName: currentDriver.abbrevName || currentDriver.userName || `#${currentDriver.carNumber || carIdx}`,
      initials: currentDriver.initials || "PIL",
      userId: currentDriver.userId || 0,
      teamId: currentDriver.teamId || 0,
      teamName: currentDriver.teamName || "",
      carNumber: currentDriver.carNumber || String(carIdx),
      carNumberRaw: currentDriver.carNumberRaw ?? carIdx,
      carPath,
      carClassId: currentDriver.carClassId || 0,
      carScreenName: currentDriver.carScreenName || "iRacing Car",
      carScreenNameShort: currentDriver.carScreenNameShort || currentDriver.carScreenName || "Car",
      carClassShortName: currentDriver.carClassShortName || "Class",
      carClassColor: currentDriver.carClassColor || "#38bdf8",
      carClassEstLapTime: currentDriver.carClassEstLapTime || 90.0,
      iRating: currentDriver.iRating || 1350,
      licLevel: currentDriver.licLevel || 0,
      licSubLevel: currentDriver.licSubLevel || 0,
      licString: licStr,
      licColor: currentDriver.licColor || getLicenseColor(licStr),
      isPaceCar: false,
      isSpectator: false,
      isAi: !!currentDriver.isAi,
    };
    currentDriver = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Top level section detection
    if (/^[A-Za-z0-9_]+:/.test(trimmed) && !rawLine.startsWith(" ") && !rawLine.startsWith("\t")) {
      commitDriver();
      commitResult();
      inDriversList = false;
      inResultsPositions = false;
      currentSection = trimmed.split(":")[0];
      continue;
    }

    if (currentSection === "WeekendInfo") {
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx > 0) {
        const key = trimmed.slice(0, colonIdx).trim();
        const val = sanitizeYamlString(trimmed.slice(colonIdx + 1));
        if (key === "TrackName") weekendInfo.trackName = val;
        else if (key === "TrackConfigName") weekendInfo.trackConfigName = val;
        else if (key === "TrackID") weekendInfo.trackId = parseInt(val, 10) || 0;
        else if (key === "Category") weekendInfo.category = val;
        else if (key === "IncidentLimit") weekendInfo.incidentLimit = parseInt(val, 10) || 0;
        else if (key === "TrackLength") {
          // E.g. "4.65 km" or "2.89 mi"
          const num = parseFloat(val);
          if (!isNaN(num)) {
            weekendInfo.trackLengthM = val.toLowerCase().includes("km") ? num * 1000 : num * 1609.34;
          }
        }
      }
      continue;
    }

    if (currentSection === "DriverInfo") {
      if (trimmed.startsWith("Drivers:")) {
        inDriversList = true;
        continue;
      }
      if (!inDriversList) {
        const colonIdx = trimmed.indexOf(":");
        if (colonIdx > 0) {
          const key = trimmed.slice(0, colonIdx).trim();
          const val = sanitizeYamlString(trimmed.slice(colonIdx + 1));
          if (key === "DriverCarEstLapTime") {
            const parsed = parseFloat(val);
            if (!isNaN(parsed) && parsed > 0) driverCarEstLapTime = parsed;
          } else if (key === "DriverCarIdx") {
            const parsed = parseInt(val, 10);
            if (!isNaN(parsed)) driverCarIdx = parsed;
          }
        }
        continue;
      }

      // Inside Drivers list
      if (trimmed.startsWith("- ") || trimmed.startsWith("-CarIdx:")) {
        commitDriver();
        currentDriver = {};
        const content = trimmed.startsWith("- ") ? trimmed.slice(2).trim() : trimmed.slice(1).trim();
        const colonIdx = content.indexOf(":");
        if (colonIdx > 0) {
          const key = content.slice(0, colonIdx).trim();
          const val = sanitizeYamlString(content.slice(colonIdx + 1));
          applyDriverField(currentDriver, key, val);
        }
        continue;
      }

      if (currentDriver) {
        const colonIdx = trimmed.indexOf(":");
        if (colonIdx > 0) {
          const key = trimmed.slice(0, colonIdx).trim();
          const val = sanitizeYamlString(trimmed.slice(colonIdx + 1));
          applyDriverField(currentDriver, key, val);
        }
      }
      continue;
    }

    if (currentSection === "SessionInfo") {
      if (trimmed.startsWith("- SessionNum:")) {
        commitResult();
        inResultsPositions = false;
        currentSessNum = parseInt(trimmed.slice(13).trim(), 10) || 0;
        sessionNum = currentSessNum;
      } else if (trimmed.startsWith("SessionNum:")) {
        commitResult();
        inResultsPositions = false;
        currentSessNum = parseInt(trimmed.slice(11).trim(), 10) || 0;
        sessionNum = currentSessNum;
      } else if (trimmed.startsWith("SessionType:")) {
        sessionType = sanitizeYamlString(trimmed.slice(12));
      } else if (trimmed.startsWith("ResultsPositions:")) {
        commitResult();
        inResultsPositions = true;
      } else if (trimmed.startsWith("ResultsFastestLap:") || trimmed.startsWith("ResultsAverageLapTime:") || trimmed.startsWith("SessionTime:")) {
        commitResult();
        inResultsPositions = false;
      } else if (inResultsPositions) {
        if (trimmed.startsWith("- ")) {
          commitResult();
          currentResult = {};
          const content = trimmed.slice(2).trim();
          const colonIdx = content.indexOf(":");
          if (colonIdx > 0) {
            applyResultField(currentResult, content.slice(0, colonIdx).trim(), sanitizeYamlString(content.slice(colonIdx + 1)));
          }
        } else if (currentResult) {
          const colonIdx = trimmed.indexOf(":");
          if (colonIdx > 0) {
            applyResultField(currentResult, trimmed.slice(0, colonIdx).trim(), sanitizeYamlString(trimmed.slice(colonIdx + 1)));
          }
        }
      }
    } else if (currentSection === "SplitTimeInfo") {
      if (trimmed.startsWith("- SectorNum:")) {
        currentSectorNum = parseInt(trimmed.slice(12).trim(), 10);
      } else if (trimmed.startsWith("SectorNum:")) {
        currentSectorNum = parseInt(trimmed.slice(10).trim(), 10);
      } else if (trimmed.startsWith("SectorStartPct:") && currentSectorNum !== null) {
        const startPct = parseFloat(trimmed.slice(15).trim());
        if (!isNaN(startPct) && startPct >= 0 && startPct <= 1) {
          sectors.push({ sectorNum: currentSectorNum, startPct });
        }
        currentSectorNum = null;
      }
    }
  }

  commitDriver();
  commitResult();
  sectors.sort((a, b) => a.startPct - b.startPct);

  return {
    update: updateNum,
    weekendInfo,
    driverInfo: {
      drivers,
      driverCarEstLapTime,
      driverCarIdx,
    },
    sessionType,
    sessionNum,
    sessionResults,
    sectors: sectors.length > 0 ? sectors : undefined,
  };
}

function applyResultField(r: Partial<SessionResultPosition>, key: string, val: string) {
  switch (key) {
    case "Position": r.position = parseInt(val, 10) || 0; break;
    case "ClassPosition": r.classPosition = parseInt(val, 10) || 0; break;
    case "CarIdx": r.carIdx = parseInt(val, 10); break;
    case "FastestTime": r.fastestTime = parseFloat(val) || 0; break;
    case "LastTime": r.lastTime = parseFloat(val) || 0; break;
    case "LapsComplete": r.lapsComplete = parseInt(val, 10) || 0; break;
    case "Time": r.timeGap = parseFloat(val) || 0; break;
  }
}

function applyDriverField(d: Partial<Driver>, key: string, val: string) {
  switch (key) {
    case "CarIdx": d.carIdx = parseInt(val, 10); break;
    case "UserName": d.userName = val; break;
    case "AbbrevName": d.abbrevName = val; break;
    case "Initials": d.initials = val; break;
    case "UserID": d.userId = parseInt(val, 10) || 0; break;
    case "TeamID": d.teamId = parseInt(val, 10) || 0; break;
    case "TeamName": d.teamName = val; break;
    case "CarNumber": d.carNumber = val; break;
    case "CarNumberRaw": d.carNumberRaw = parseInt(val, 10) || 0; break;
    case "CarPath": d.carPath = val; break;
    case "CarClassID": d.carClassId = parseInt(val, 10) || 0; break;
    case "CarScreenName": d.carScreenName = val; break;
    case "CarScreenNameShort": d.carScreenNameShort = val; break;
    case "CarClassShortName": d.carClassShortName = val; break;
    case "CarClassColor": d.carClassColor = parseColor(val); break;
    case "CarClassEstLapTime": {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) d.carClassEstLapTime = num;
      break;
    }
    case "IRating": d.iRating = parseInt(val, 10) || 0; break;
    case "LicLevel": d.licLevel = parseInt(val, 10) || 0; break;
    case "LicSubLevel": d.licSubLevel = parseInt(val, 10) || 0; break;
    case "LicString": d.licString = val; d.licColor = getLicenseColor(val); break;
    case "LicColor": d.licColor = parseColor(val); break;
    case "CarIsPaceCar": d.isPaceCar = val === "1" || val.toLowerCase() === "true"; break;
    case "IsSpectator": d.isSpectator = val === "1" || val.toLowerCase() === "true"; break;
    case "CarIsAI": d.isAi = val === "1" || val.toLowerCase() === "true"; break;
  }
}
