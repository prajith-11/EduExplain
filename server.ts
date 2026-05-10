import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import fs from "fs";

const app = express();
const PORT = 3000;

app.use(express.json());

// --- DATA PROCESSING LOGIC (Replicating Python Code) ---

interface StudentRecord {
  sex: number;
  age: number;
  traveltime: number;
  studytime: number;
  activities: number;
  failures: number;
  internet: number;
  health: number;
  absences: number;
  goout: number;
  freetime: number;
  Mid1: number;
  Mid2: number;
  Final: number;
  Grade_Class: string;
}

let dataset: StudentRecord[] = [];

const assignGrade = (score: number) => {
  if (score >= 8.75) return 'A';
  if (score >= 7.0) return 'B';
  if (score >= 5.0) return 'C';
  if (score >= 3.75) return 'D';
  return 'F';
};

async function loadDataset() {
  try {
    console.log("Fetching UCI Student Performance dataset...");
    const url = "https://archive.ics.uci.edu/static/public/320/student+performance.zip";
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const zip = new AdmZip(Buffer.from(response.data));
    
    // Extract student.zip
    const studentZipBuffer = zip.getEntry("student.zip")?.getData();
    if (!studentZipBuffer) throw new Error("student.zip not found in main download");
    
    const innerZip = new AdmZip(studentZipBuffer);
    const mathCsvBuffer = innerZip.getEntry("student-mat.csv")?.getData();
    if (!mathCsvBuffer) throw new Error("student-mat.csv not found in student.zip");
    
    const csvContent = mathCsvBuffer.toString('utf-8');
    const records = parse(csvContent, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true
    });

    dataset = records.map((row: any) => {
      const g3_norm = Number(row.G3) * 0.5; // Scale to 10
      return {
        sex: row.sex === 'F' ? 1 : 0,
        age: Number(row.age),
        traveltime: Number(row.traveltime),
        studytime: Number(row.studytime),
        activities: row.activities === 'yes' ? 1 : 0,
        failures: Number(row.failures),
        internet: row.internet === 'yes' ? 1 : 0,
        health: Number(row.health),
        absences: Number(row.absences),
        goout: Number(row.goout),
        freetime: Number(row.freetime),
        Mid1: Number(row.G1) * 1.5, // Scale to 30
        Mid2: Number(row.G2) * 1.5, // Scale to 30
        Final: g3_norm,
        Grade_Class: assignGrade(g3_norm)
      };
    });

    // Add Anchor Rows (Outliers) - Replicating Python Code
    const anchors: StudentRecord[] = [
      { sex: 1, age: 18, traveltime: 1, studytime: 4, activities: 1, failures: 0, internet: 1, health: 5, absences: 0, goout: 2, freetime: 3, Mid1: 28.5, Mid2: 29.25, Final: 9.75, Grade_Class: 'A' },
      { sex: 0, age: 18, traveltime: 1, studytime: 3, activities: 1, failures: 0, internet: 1, health: 4, absences: 2, goout: 2, freetime: 3, Mid1: 22.5, Mid2: 23.25, Final: 7.75, Grade_Class: 'B' },
      { sex: 1, age: 17, traveltime: 1, studytime: 2, activities: 0, failures: 0, internet: 1, health: 3, absences: 4, goout: 3, freetime: 3, Mid1: 16.5, Mid2: 17.25, Final: 5.75, Grade_Class: 'C' },
      { sex: 0, age: 17, traveltime: 1, studytime: 2, activities: 0, failures: 1, internet: 1, health: 3, absences: 8, goout: 4, freetime: 3, Mid1: 12.0, Mid2: 12.75, Final: 4.25, Grade_Class: 'D' },
      { sex: 1, age: 19, traveltime: 1, studytime: 1, activities: 0, failures: 3, internet: 0, health: 2, absences: 20, goout: 5, freetime: 2, Mid1: 3.0, Mid2: 3.75, Final: 1.25, Grade_Class: 'F' }
    ];
    dataset = [...dataset, ...anchors];

    console.log(`✅ Success! Dataset ready with ${dataset.length} records.`);
  } catch (error) {
    console.error("❌ Error loading dataset:", error);
  }
}

loadDataset();

// --- PREDICTION ALGORITHM (Two-Stage Weighted KNN) ---

function predict(student: any) {
  if (dataset.length === 0) return null;

  const normalize = (val: number, min: number, max: number) => (val - min) / (max - min || 1);

  // STAGE 1: Regressor (Trend Prediction)
  // Features: sex, age, traveltime, studytime, activities, failures, internet, health, absences, goout, freetime, Mid1, Mid2
  const getRegDistance = (s1: any, s2: any) => {
    let dist = 0;
    dist += Math.pow(normalize(s1.Mid2, 0, 30) - normalize(s2.Mid2, 0, 30), 2) * 15;
    dist += Math.pow(normalize(s1.Mid1, 0, 30) - normalize(s2.Mid1, 0, 30), 2) * 12;
    dist += Math.pow(normalize(s1.failures, 0, 4) - normalize(s2.failures, 0, 4), 2) * 8;
    dist += Math.pow(normalize(s1.studytime, 1, 4) - normalize(s2.studytime, 1, 4), 2) * 5;
    dist += Math.pow(normalize(s1.absences, 0, 93) - normalize(s2.absences, 0, 93), 2) * 3;
    dist += Math.pow(normalize(s1.age, 15, 22) - normalize(s2.age, 15, 22), 2) * 1;
    return Math.sqrt(dist);
  };

  const regNeighbors = [...dataset]
    .map(d => ({ ...d, distance: getRegDistance(student, d) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);

  const regTotalWeight = regNeighbors.reduce((acc, n) => acc + (1 / (n.distance + 0.01)), 0);
  const predictedG3 = regNeighbors.reduce((acc, n) => acc + (n.Final * (1 / (n.distance + 0.01))), 0) / regTotalWeight;

  // STAGE 2: Classifier (Grade Prediction)
  // Features: sex, age, traveltime, studytime, activities, failures, internet, health, absences, goout, freetime, Predicted_G3
  const getClfDistance = (s1: any, s2: any, s1Trend: number, s2Trend: number) => {
    let dist = 0;
    dist += Math.pow(normalize(s1Trend, 0, 10) - normalize(s2Trend, 0, 10), 2) * 20; // Predicted_G3 is most important
    dist += Math.pow(normalize(s1.failures, 0, 4) - normalize(s2.failures, 0, 4), 2) * 10;
    dist += Math.pow(normalize(s1.studytime, 1, 4) - normalize(s2.studytime, 1, 4), 2) * 5;
    dist += Math.pow(normalize(s1.absences, 0, 93) - normalize(s2.absences, 0, 93), 2) * 3;
    return Math.sqrt(dist);
  };

  // For Stage 2, we need to compare against the "Predicted_G3" of the dataset records too
  // In the Python code, df_final['Predicted_G3'] = regressor.predict(df_final[reg_features])
  // We'll approximate this by using their actual 'Final' grade as their 'Predicted_G3' for the training set
  const clfNeighbors = [...dataset]
    .map(d => ({ ...d, distance: getClfDistance(student, d, predictedG3, d.Final) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 7);

  // Vote for the class
  const votes: Record<string, number> = {};
  clfNeighbors.forEach(n => {
    const weight = 1 / (n.distance + 0.01);
    votes[n.Grade_Class] = (votes[n.Grade_Class] || 0) + weight;
  });

  const finalClass = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
  const confidence = votes[finalClass] / Object.values(votes).reduce((a, b) => a + b, 0);

  return {
    predictedGrade: Number(predictedG3.toFixed(2)),
    gradeClass: finalClass,
    confidence: Number(confidence.toFixed(4))
  };
}

// --- API ROUTES ---

app.post("/api/predict", (req, res) => {
  const { students } = req.body;
  if (!students || !Array.isArray(students)) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const results = students.map(s => {
    const prediction = predict(s);
    return {
      ...prediction,
      // We still use Gemini for explanation to keep it "Explainable AI"
      // but the core prediction is now deterministic based on the Python logic/dataset
    };
  });

  res.json(results);
});

// --- VITE MIDDLEWARE ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
