<template>
  <div id="app">
    <v-container class="fill height">
      <v-row justify="center" allign="center">
        <v-col cols="12" sm="8" md="4">
          <v-text-field label="OAuth Token" variant="outlined"></v-text-field>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
// const token = ref("");

// async function soundcloudInit() {
//   if (!token.value) {
//     console.error("Token is required!");
//     return;
//   }
//   await window.electron.ipcRenderer.invoke("soundcloud-init", token.value);
// }

onMounted(async () => {
  await window.electron.ipcRenderer.invoke("soundcloud-init");
});
</script>
