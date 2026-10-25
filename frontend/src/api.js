import axios from 'axios';
export const api=axios.create({baseURL:import.meta.env.VITE_API_BASE_URL||'http://localhost:4000/api',withCredentials:true});
api.interceptors.response.use(r=>r.data.data,e=>Promise.reject(new Error(e.response?.data?.error||'Could not connect to Domain Hub')));
