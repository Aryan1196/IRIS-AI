import axios from 'axios'

const AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_KEY || 'http://localhost:4000',
})

export default AxiosInstance
