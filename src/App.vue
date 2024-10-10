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
        <q-input dark outlined v-model="text" label="Outlined" />
      </div>
    </div>
    <button @click="DownloadSet">Download Set</button>
    <q-input
      filled
      v-model="consoleOutput"
      label="Console Logs"
      type="textarea"
      style="height: 200px"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
const consoleOutput = ref("");
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
  await window.electron.ipcRenderer.on("log-message", (message) => {
    consoleOutput.value += message + "\n";
  });
  await fetchData();
});
</script>

<style></style>
