import { useState } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import { Info, Upload, FileText, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AtsChecker = () => {
  const [resume, setResume] = useState(null);
  const [jobDescription, setJobDescription] = useState('');
  const [score, setScore] = useState(null);
  const [message, setMessage] = useState('');
  const [jobRecommendations, setJobRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingJobs, setFetchingJobs] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => setResume(acceptedFiles[0]),
    accept: { 'application/pdf': ['.pdf'] },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resume || !jobDescription) {
      alert('Please upload a resume and enter a job description.');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('resume', resume);
    formData.append('jobDescription', jobDescription);

    try {
      const res = await axios.post('http://localhost:3000/api/ats-check', formData);
      const score = res.data.score;
      const message = res.data.message;
      const recommendations = res.data.recommendations || [];

      setScore(score);
      setMessage(message);
      setJobRecommendations(recommendations);

      // ✅ Save the results to MongoDB
      await axios.post('http://localhost:3000/api/store-results', {
        score,
        jobDescription,
        recommendations,
      }); 

    } catch (error) {
      alert('Error checking ATS score. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobRecommendations = async () => {
    if (!score || !jobDescription) return;
    setFetchingJobs(true);

    try {
      const res = await axios.post('http://localhost:3000/api/job-recommendations', {
        score,
        jobDescription,
      });
      setJobRecommendations(res.data.recommendations || []);
      setShowModal(true);
    } catch (error) {
      alert('Error fetching job recommendations. Please try again.');
      console.error(error);
    } finally {
      setFetchingJobs(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-100 to-blue-50 py-10 px-4 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl bg-white shadow-2xl rounded-3xl p-8 space-y-8"
      >
        <h1 className="text-5xl font-bold text-center text-blue-700">Smart ATS Score Checker</h1>

        {/* Info Card */}
        <div className="flex items-start gap-4 bg-blue-50 p-4 border-l-4 border-blue-500 rounded-xl">
          <Info className="w-6 h-6 text-blue-700 mt-1" />
          <div>
            <h2 className="text-xl font-semibold text-blue-700">How it Works</h2>
            <p className="text-sm text-gray-700 mt-1">
              Smart ATS analyzes your resume against job descriptions, checking keyword match, skill alignment,
              and relevance. Get your ATS score, detailed feedback, and personalized job recommendations.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Resume Upload */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragActive ? 'bg-blue-100 border-blue-500' : 'bg-gray-50 border-gray-300'
            }`}
          >
            <input {...getInputProps()} />
            {resume ? (
              <p className="text-sm font-medium text-blue-700 flex justify-center items-center gap-2">
                <FileText className="w-5 h-5" /> {resume.name}
              </p>
            ) : (
              <p className="text-gray-500 text-sm flex justify-center items-center gap-2">
                <Upload className="w-5 h-5" />
                Drag & drop your resume here, or click to upload (PDF)
              </p>
            )}
          </div>

          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            placeholder="Paste the job description here..."
            className="w-full p-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring--400 h-48 resize-none text-blue-500 bg-gray-100"
            required
          />

          {/* Submit Button */}
          <motion.button
            type="submit"
            className="col-span-1 md:col-span-2 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition duration-300 flex justify-center items-center gap-2"
            disabled={loading}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Analyze My Resume'}
          </motion.button>
        </form>

        {score !== null && (
          <div className="bg-green-50 border-l-4 border-green-500 rounded-xl p-6">
            {/* Horizontal Progress Bar */}
            <div className="mb-6">
              <p className="text-center text-green-600 font-bold text-xl mb-2">ATS Score: {score}%</p>
              <div className="w-full bg-green-100 rounded-full h-5 overflow-hidden">
                <div
                  className="bg-green-500 h-full transition-all duration-500"
                  style={{ width: `${score}%` }}
                ></div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="flex-1 space-y-2 text-sm text-gray-700">
                {message.split('\n').map((line, idx) => (
                  <p
                    key={idx}
                    className={
                      line.startsWith('**')
                        ? 'font-semibold text-blue-700 text-base mt-3'
                        : line.startsWith('*')
                        ? 'pl-4 border-l-2 border-blue-400 text-sm text-gray-700'
                        : 'text-sm'
                    }
                  >
                    {line.replace(/\*\*/g, '')}
                  </p>
                ))}
              </div>
            </div>

            <button
              onClick={fetchJobRecommendations}
              disabled={fetchingJobs}
              className="mt-6 w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition"
            >
              {fetchingJobs ? 'Getting Recommendations...' : '🎯 View Job Recommendations'}
            </button>
          </div>
        )}
      </motion.div>

      {/* Side Panel with Job Cards */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 bg-black bg-opacity-40 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
            />

            {/* Job Recommendations Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-lg z-50 flex flex-col"
            >
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-xl font-semibold text-purple-700 flex items-center gap-2">
                  <Sparkles className="w-5 h-5" /> Job Recommendations
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-600 hover:text-black text-2xl font-bold"
                >
                  &times;
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {jobRecommendations.length > 0 ? (
                  jobRecommendations.map((job, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                    >
                      <h4 className="text-lg font-medium text-gray-800">{job.title}</h4>
                      <p className="text-sm text-gray-600 mb-1">{job.company}</p>
                      <p className="text-sm text-gray-500 mb-2">{job.location || 'Location not specified'}</p>
                      <p className="text-sm text-gray-700 mb-2">
                        {job.description?.slice(0, 100) || 'No description available'}...
                      </p>
                      {job.link && (
                        <a
                          href={job.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 text-sm hover:underline"
                        >
                          View Job Posting
                        </a>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No job recommendations available.</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AtsChecker;
