<template>
  <img v-if="!loaded" src="../src/assets/loading.gif" alt="Loading" />
  <div v-if="loaded">
    <div class="q-pa-md" style="max-width: 300px">
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
    <q-input dark outlined v-model="text" label="Outlined" />
    <button @click="DownloadSet">Download Set</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
const text = ref(null);
const sets = ref(null);
const model = ref(null);
const loaded = ref(false);

async function logout() {
  await window.electron.ipcRenderer.invoke("soundcloud-logout");
  window.location.reload();
}
async function DownloadSet() {
  const response = await window.electron.ipcRenderer.invoke(
    "download-set",
    text.value
  );
  console.log("Set Download Sucessfuly", response);
}
async function fetchData() {
  const result = await window.electron.ipcRenderer.invoke("soundcloud-init");

  if (result) {
    sets.value = result.map((url) => url.split("sets/")[1].split("/")[0]);
    sets.value.push("Liked Tracks");
    sets.value.push("all");

    loaded.value = true;
  }
}

onMounted(async () => {
  await fetchData();
});
</script>

<style></style>
