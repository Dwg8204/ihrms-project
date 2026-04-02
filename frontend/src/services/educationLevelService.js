import api from './http';

export const educationLevelService = {
  getEducationLevels: async (params = {}) => {
    const { data } = await api.get('/education-levels', { params });
    return data;
  }
};
