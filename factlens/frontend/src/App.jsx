import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Analyze from "./pages/Analyze.jsx";
import Result from "./pages/Result.jsx";
import History from "./pages/History.jsx";
import Models from "./pages/Models.jsx";
import About from "./pages/About.jsx";
import Help from "./pages/Help.jsx";

// To add a page: create src/pages/X.jsx, add a <Route> below, add a nav item in Sidebar.jsx.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      {/* Public pages: no login required */}
      <Route element={<Layout />}>
        <Route path="/about" element={<About />} />
        <Route path="/help" element={<Help />} />
      </Route>
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Navigate to="/analyze" replace />} />
        <Route path="/analyze" element={<Analyze />} />
        <Route path="/result/:id" element={<Result />} />
        <Route path="/history" element={<History />} />
        <Route path="/models" element={<Models />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
