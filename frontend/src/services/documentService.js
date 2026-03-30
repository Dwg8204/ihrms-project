import api from './http';

export const documentService = {
  getDocumentTypes: async (phase) => {
    const { data } = await api.get('/document-types', { params: phase ? { phase } : {} });
    return data;
  },

  initCandidateDocuments: async (candidateId, phase) => {
    const { data } = await api.post(`/candidates/${candidateId}/documents/init`, {
      phase
    });
    return data;
  },

  getCandidateDocuments: async (candidateId, phase) => {
    const { data } = await api.get(`/candidates/${candidateId}/documents`, {
      params: phase ? { phase } : {}
    });
    return data;
  },

  updateCandidateDocument: async (candidateId, documentTypeCode, formData) => {
    const { data } = await api.patch(
      `/candidates/${candidateId}/documents/${documentTypeCode}`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' }
      }
    );
    return data;
  },

  getPreExamReadiness: async (candidateId) => {
    const { data } = await api.get(
      `/candidates/${candidateId}/documents/pre-exam-readiness`
    );
    return data;
  },

  getHealthExpiryAlerts: async (days = 30) => {
    const { data } = await api.get('/alerts/health-expiry', {
      params: { days }
    });
    return data;
  },

  getVisaDelayAlerts: async () => {
    const { data } = await api.get('/alerts/visa-delay');
    return data;
  }
};
