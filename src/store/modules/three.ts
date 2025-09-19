import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useThreeStore = defineStore('three', () => {
  const scrollY = ref(0);

  return { scrollY };
});
