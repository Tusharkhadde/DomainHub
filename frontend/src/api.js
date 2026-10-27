import axios from 'axios';
export const api=axios.create({baseURL:'/api',withCredentials:true});
api.interceptors.response.use(r=>r.data.data,e=>{
  if(e.response?.status===401&&!/\/auth\//.test(e.config?.url||''))window.dispatchEvent(new Event('domainhub:unauthorized'));
  return Promise.reject(new Error(e.response?.data?.error||'Could not connect to Domain Hub'));
});
