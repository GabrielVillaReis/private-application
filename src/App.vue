<template>
  <img v-if="!loaded" src="../src/assets/loading.gif" alt="Loading" />
  <div v-if="loaded">
    <div dark class="q-pa-md" style="max-width: 300px">
      <div class="q-gutter-md">
        <q-btn flat color="teal" label="Logout" @click="logout" />
        <q-select
          dark
          outlined
          v-model="model"
          :options="sets"
          label="Set"
          color="teal"
        />
      </div>
    </div>
    <button @click="storeAllSets">Store All Sets</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
const sets = ref(null);
const model = ref(null);
const loaded = ref(false);

async function logout() {
  await window.electron.ipcRenderer.invoke("soundcloud-logout");
  window.location.reload();
}
async function storeAllSets() {
  const response = await window.electron.ipcRenderer.invoke(
    "soundcloud-get-full-library"
  );
  console.log("Stored all sets:", response);
}
async function fetchData() {
  while (sets.value == null) {
    sets.value = await window.electron.ipcRenderer.invoke("soundcloud-init");
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  sets.value = sets.value.map((url) => url.split("sets/")[1].split("/")[0]);
  sets.value.push("Liked Tracks");
  loaded.value = true;
}

onMounted(async () => {
  await fetchData();
  this.$q.dark.set(true);
});
</script>

<style></style>
