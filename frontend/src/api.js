import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 60000 })

api.interceptors.response.use(
  res => res.data,
  err => Promise.reject(err.response?.data?.error || err.message || 'Onbekende fout')
)

// Concepts
export const getConcepts = (status) => api.get('/concepts', { params: status ? { status } : {} })
export const getConcept = (id) => api.get(`/concepts/${id}`)
export const updateConcept = (id, data) => api.put(`/concepts/${id}`, data)
export const approveConcept = (id) => api.put(`/concepts/${id}/approve`)
export const rejectConcept = (id) => api.put(`/concepts/${id}/reject`)
export const publishConcept = (id) => api.post(`/concepts/${id}/publish`)
export const bulkApprove = (ids) => api.put('/concepts/bulk/approve', { ids })
export const bulkReject = (ids) => api.put('/concepts/bulk/reject', { ids })
export const getConceptStats = () => api.get('/concepts/stats/summary')

// Agent
export const runAgent = (niche, count) => api.post('/agent/run', { niche, count })
export const getAgentStatus = () => api.get('/agent/status')
export const getAgentLogs = (limit = 100) => api.get('/agent/logs', { params: { limit } })
export const getNicheAnalysis = () => api.get('/agent/niche-analysis')
export const getAgentCosts = () => api.get('/agent/costs')
export const getAvailableNiches = () => api.get('/agent/niches')
export const getWeeklyReport = () => api.get('/agent/reports/weekly')

// Shops
export const getShops = () => api.get('/shops')
export const getShop = (id) => api.get(`/shops/${id}`)
export const createShop = (data) => api.post('/shops', data)
export const updateShop = (id, data) => api.put(`/shops/${id}`, data)
export const deleteShop = (id) => api.delete(`/shops/${id}`)
export const getShopListings = (id) => api.get(`/shops/${id}/listings`)
export const syncShopStats = (id) => api.post(`/shops/${id}/sync`)

// Settings
export const getSettings = () => api.get('/settings')
export const saveSettings = (data) => api.put('/settings', data)
export const exportData = () => window.open('/api/settings/export', '_blank')

export default api
