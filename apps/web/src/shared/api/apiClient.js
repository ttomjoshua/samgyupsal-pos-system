import axios from 'axios'

const runtimeEnv = import.meta.env || {}

const api = axios.create({
  baseURL:
    runtimeEnv.VITE_API_BASE_URL ||
    runtimeEnv.VITE_API_URL ||
    'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export default api
