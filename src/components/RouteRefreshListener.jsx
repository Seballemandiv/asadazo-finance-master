import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function RouteRefreshListener() {
  const navigate = useNavigate();
  useEffect(() => {
    const refresh = () => navigate(0);
    window.addEventListener("asadazo:pull-refresh", refresh);
    return () => window.removeEventListener("asadazo:pull-refresh", refresh);
  }, [navigate]);
  return null;
}
