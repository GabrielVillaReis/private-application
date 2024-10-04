<template>
  <img v-if="!loaded" src="../src/assets/loading.gif" alt="Loading" />
  <div v-if="loaded">
    <h1>{{ token }}</h1>
    <button @click="storeAllSets">Store All Sets</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
const token = ref(null);
const loaded = ref(false);

async function storeAllSets() {
  const response = await window.electron.ipcRenderer.invoke(
    "soundcloud-get-full-library"
  );
  console.log("Stored all sets:", response);
}
async function fetchData() {
  while (token.value == null) {
    token.value = await window.electron.ipcRenderer.invoke("soundcloud-init");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  loaded.value = true;
}

onMounted(async () => {
  await fetchData();
});
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: white;
  margin-top: 60px;
}
</style>
