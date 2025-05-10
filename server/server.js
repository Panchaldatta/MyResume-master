
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
let port = process.env.PORT || 3000;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(fileUpload());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

const UserSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  name: String,
  email: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now }
});

const ResumeSchema = new mongoose.Schema({
  userId: String,
  fileName: String,
  uploadDate: { type: Date, default: Date.now },
  atsScore: { type: Number, min: 0, max: 100 },
  parsedContent: String
});

const JobSchema = new mongoose.Schema({
  jobTitle: String,
  company: String,
  requiredSkills: String
});

const AtsScanSchema = new mongoose.Schema({
  resumeId: String,
  jobId: String,
  matchPercentage: { type: Number, min: 0, max: 100 },
  parsedData: String,
  recommendations: Array
});

const User = mongoose.model('User', UserSchema);
const Resume = mongoose.model('Resume', ResumeSchema);
const Job = mongoose.model('Job', JobSchema);
const AtsScan = mongoose.model('AtsScan', AtsScanSchema);

const upload = multer({ dest: 'uploads/' });

app.post('/api/auth', async (req, res) => {
  const { userId, name, email } = req.body;
  try {
    let user = await User.findOne({ userId });
    if (!user) {
      user = await User.create({ userId, name, email });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error handling authentication');
  }
});

app.get('/api/list-models', async (req, res) => {
  try {
    const response = await axios.get(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`);
    res.json(response.data);
  } catch (error) {
    console.error('Error listing models:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || 'Internal server error' });
  }
});

app.post('/api/ats-check', async (req, res) => {
  try {
    const resumeFile = req.files?.resume;
    const jobDescription = req.body.jobDescription;

    if (!resumeFile || !jobDescription) {
      return res.status(400).json({ error: 'Resume and Job Description are required' });
    }

    const pdfData = await pdfParse(resumeFile.data);
    const resumeText = pdfData.text;

    const prompt = `Evaluate the compatibility of this resume with the job description and provide an ATS score (0-100%) with reasoning.\n\nResume:\n${resumeText}\n\nJob Description:\n${jobDescription}`;

    const response = await axios.post(
      `${GEMINI_API_URL}/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (!response.data || !response.data.candidates) {
      console.error('Invalid response from Gemini API:', response.data);
      return res.status(500).json({ error: 'Invalid response from Gemini API' });
    }

    const resultText = response.data.candidates[0]?.content?.parts
      ?.map(part => part.text)
      .join(' ') || '';

    // const scoreMatch = resultText.match(/ATS Score:\s*(\d{1,3})-?(\d{1,3})?%/i);
    const scoreMatch = resultText.match(/(?:ATS|Score)[^\d]*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?\s*%?/i);

    
    let score = 0;

    if (scoreMatch) {
      const lower = parseInt(scoreMatch[1], 10);
      const upper = scoreMatch[2] ? parseInt(scoreMatch[2], 10) : lower;
      score = Math.round((lower + upper) / 2);
    }

    return res.json({ score, message: resultText });
  } catch (error) {
    console.error('Error checking ATS score:', error.response?.data || error.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: error.response?.data || 'Internal server error' });
    }
  }
});

app.post('/api/job-recommendations', async (req, res) => {
  const { score, jobDescription } = req.body;

  if (!score || !jobDescription) {
    return res.status(400).json({ error: 'Score and job description are required' });
  }

  const recommendations = [
    {
      title: 'Frontend Developer',
      company: 'TCS',
      location: 'Bangalore, India',
      description: 'Work on modern UI with React and TypeScript.',
      link: 'https://careers.tcs.com/frontend-developer'
    },
    {
      title: 'React Engineer',
      company: 'Inedge',
      location: 'Remote',
      description: 'Join our team to build intelligent dashboards using React and Next.js.',
      link: 'https://inedge.io/careers/react-engineer'
    },
    {
      title: 'Full Stack Developer',
      company: 'DevHub',
      location: 'Hyderabad, India',
      description: 'Build scalable APIs and responsive frontends using MERN stack.',
      link: 'https://devhub.io/jobs/fullstack'
    },
    {
      title: 'Full Stack Developer',
      company: 'DevHub',
      location: 'Hyderabad, India',
      description: 'Build scalable APIs and responsive frontends using MERN stack.',
      link: 'https://devhub.io/jobs/fullstack'
    },
    {
      title: 'Full Stack Developer',
      company: 'DevHub',
      location: 'Hyderabad, India',
      description: 'Build scalable APIs and responsive frontends using MERN stack.',
      link: 'https://devhub.io/jobs/fullstack'
    }
  ];

  res.json({ recommendations });
});

app.post('/api/store-results', async (req, res) => {
  const { score, jobDescription, recommendations } = req.body;

  if (score === undefined || !jobDescription || !recommendations) {
    return res.status(400).json({ error: 'Score, job description, and recommendations are required' });
  }

  try {
    const atsScan = new AtsScan({
      resumeId: 'placeholder',
      jobId: 'placeholder',
      matchPercentage: score,
      parsedData: jobDescription,
      recommendations
    });

    await atsScan.save();
    res.status(201).json({ message: 'Results stored successfully' });
  } catch (error) {
    console.error('Error storing results:', error);
    res.status(500).json({ error: 'Failed to store results' });
  }
});

const server = app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`Port ${port} is in use, trying next port...`);
    port += 1;
    server.listen(port, () => console.log(`Server running on http://localhost:${port}`));
  } else {
    console.error('Server error:', err);
  }
});
