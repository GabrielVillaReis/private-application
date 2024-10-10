const { app, BrowserWindow, ipcMain, session, window } = require("electron");
const path = require("node:path");
const soundcloud = require("./soundcloud");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const createWindow = async () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: true,
    },
  });
  mainWindow.setMenu(null);

  // Desabilitar barra de rolagem via CSS
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.insertCSS(
      "html, body { overflow: hidden !important; }"
    );
  });

  const originalConsoleLog = console.log;
  console.log = async function (...args) {
    // Usar JSON.stringify para converter objetos em strings JSON
    const logMessage = args.map((arg) => arg).join("");

    // Enviar a mensagem formatada para o app
    mainWindow.webContents.send("log-message", logMessage.replace(/,/g, "\n"));

    // Chamar o console.log original
    originalConsoleLog.apply(console, args);
  };
  if (!global.token) {
    loginSoundCloud();
  }

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

async function loginSoundCloud() {
  const hiddenWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false, // Janela invisível
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: true,
      contextIsolation: true,
    },
  });

  hiddenWindow.loadURL("https://soundcloud.com/signin");

  // Capturar cookies ou tokens após o login bem-sucedido
  hiddenWindow.webContents.on("did-navigate", async (event, url) => {
    if (url.includes("https://soundcloud.com/discover")) {
      const result = await session.defaultSession.cookies.get({});
      const OAuth = result.find((cookie) => cookie.name === "oauth_token");
      await soundcloud.setAuthorizationToken(`OAuth ${OAuth.value}`);
      hiddenWindow.close();
      await soundcloud.init();
      return;
    } else {
      hiddenWindow.show();
    }
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();
  // soundcloud.init();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
// Função backend para buscar dados da API do SoundCloud
ipcMain.handle("soundcloud-init", async (event) => {
  while (!global.sets)
    await new Promise((resolve) => setTimeout(resolve, 1000));
  return global.sets;
});

ipcMain.handle("soundcloud-logout", async (event) => {
  await soundcloud.logOut();
});

ipcMain.handle("download-set", async (event, url) => {
  await soundcloud.downloadSet(url);
});
