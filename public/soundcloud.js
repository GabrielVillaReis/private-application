const fs = require("fs");
const path = require("path");
const axios = require("axios");

global.filePath = path.join(__dirname);
global.token;
global.apiPath = "https://api-v2.soundcloud.com/"; // /tracks/track_id /sets/set_id /resolve?url=url
global.client_id;
global.set_id;
global.set_title;
global.sets;
global.cache = [];

async function setAuthorizationToken(token) {
  global.token = token;
  console.log("OAuth token:", global.token);
}
async function init() {
  await getClientID();
  await getAllSets();
  await initCache();
  await getFullLibrary();
  global.set_title = "";
  global.set_id = "";
}

async function ensureDirectoryExistence(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Generates a log of what changed in the set after the last save
async function generateLog(length, changes) {
  const now = new Date();
  const log = `Date:${now.toISOString()}\n${changes}${length} tracks stored\n`;
  console.log("\n" + log);
  fs.appendFile(
    `${global.filePath}/sets/${global.set_title}/log.txt`,
    `${log}\n`,
    (err) => {
      if (err) {
        console.error(err);
        return;
      }
    }
  );
}

// Formated track info that will be stored
async function formatedTrack(track) {
  return {
    title: track.title,
    id: track.id,
    permalink_url: track.permalink_url,
    genre: track.genre ? track.genre.trim().toLowerCase() : null,
    user: {
      id: track.user.id,
      username: track.user.username,
      permalink_url: track.user.permalink_url,
    },
    media: track.media,
  };
}

// Compare 2 datas, currently used for compare the old file to the new one to generate the log
async function compareData(data1, data2) {
  const data1Ids = new Set(data1.map((item) => item.id));
  const data2Ids = new Set(data2.map((item) => item.id));

  // filter which items in data2 are not in data1
  const removed = data2
    .filter((item) => !data1Ids.has(item.id))
    .map(
      (item) =>
        `ID: ${item.id}, ${item.title} from ${item.user.username}; link : ${item.media.transcodings[1].url}\n`
    );

  // filter which items in data1 are not in data2
  const added = data1
    .filter((item) => !data2Ids.has(item.id))
    .map(
      (item) =>
        `ID: ${item.id}, ${item.title} from ${item.user.username}; link : ${item.media.transcodings[1].url}\n`
    );
  return `Tracks added:\n${added}\nTracks removed:\n${removed}\n`;
}

// Start the cache with the values of the already saved sets
async function initCache() {
  let files;
  let dirPath = path.join(__dirname, "sets");
  console.log(dirPath);
  try {
    // Find the number of folders in the sets folder
    ensureDirectoryExistence(dirPath);
    files = fs.readdirSync(dirPath);
    console.log("Sets already stored: ", files);
  } catch (err) {
    console.error(
      "Error in function initCache() fsreaddir creating new folder"
    );
  }
  try {
    for (let file of files) {
      set_title = file;
      let data = fs.readFileSync(
        `${dirPath}/${set_title}/${set_title}.json`,
        "utf8"
      );
      const jsonString = JSON.parse(data);
      global.cache = global.cache.concat(jsonString);
    }
    // Grants that every object is unique
    await setCache();
    console.log(`${global.cache.length}: objects in cache`);
  } catch (err) {
    console.error(
      "Error in function initCache() fs.readFileSync, creating new file"
    );
  }
}

async function setCache() {
  global.cache = [
    ...new Map(global.cache.map((item) => [item.id, item])).values(),
  ];
}
// Get client id from the main page
async function getClientID() {
  let mainPath = "https://soundcloud.com/"; // https://a-v2.sndcdn.com/assets/50-cb36519b.js
  try {
    let resp = await axios.get(mainPath);
    let data = resp.data;

    // Expression to find the right file to read
    const match = data.match(
      /<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/0-[^"]+\.js)"/
    );

    if (match && match[1]) {
      console.log("Asset URL:", match[1]);
      mainPath = match[1];
    } else {
      console.log("Asset not found");
      return null;
    }
    resp = await axios.get(mainPath);
    data = resp.data;
    // Expression to find the client_id in the file
    const clientIdMatch = data.match(/["']client_id=.*?([a-zA-Z0-9]+)["']/);
    if (clientIdMatch && clientIdMatch[1]) {
      const client_id = clientIdMatch[1];
      console.log("Client ID:", client_id);
      global.client_id = client_id;
    } else {
      console.log("Client ID not found");
    }
  } catch (error) {
    console.error("Error fetching file:", error);
  }
}

// Get all sets from your library
async function getAllSets() {
  let sets = [];
  // Infinite loop until no more sets are found in library (next_href is null), it loads 10 sets per request
  let nextHref = `https://api-v2.soundcloud.com/me/library/all?client_id=${global.client_id}&limit=10&offset=0&linked_partitioning=1`;
  while (nextHref) {
    let resp = await fetch(nextHref, {
      headers: {
        accept: "*/*",
        Authorization: global.token,
      },
    });
    if (resp.status === 404) {
      console.error("Set not found");
      return;
    } else {
      let data = await resp.json(); // Track ID returned
      sets = sets.concat(
        data.collection.map((set) => set.playlist.permalink_url)
      );
      // Update the next_href for the next request
      nextHref = data.next_href;
    }
  }
  // Remove duplicates from the array and store it in global.sets
  sets = Array.from(new Set(sets));
  global.sets = sets;
  console.log("Library Sets:", sets);
}

async function getSet(url) {
  let setTracks = [];
  // Verify if a url was passed, if not the url will be the liked tracks url
  if (!url) {
    let nextHref = `https://api-v2.soundcloud.com/me/track_likes/ids?limit=200&client_id=${global.client_id}`;
    // Infinite loop until no more tracks are found in liked tracks (next_href is null), it loads 200 tracks per request
    while (nextHref) {
      let resp = await fetch(nextHref, {
        method: "GET",
        headers: {
          Authorization: global.token,
        },
      });
      if (!resp.ok) {
        console.error(`Error at fetching the Musics: ${resp.statusText}`);
        return;
      } else {
        let data = await resp.json();
        setTracks = setTracks.concat(data.collection);
        nextHref = data.next_href
          ? `${data.next_href}&client_id=${global.client_id}`
          : null;
      }
    }
    global.set_title = "Liked Tracks";
  } else {
    let resp = await fetch(global.apiPath + `resolve?url=${url}`, {
      method: "GET",
      headers: {
        accept: "application/json; charset=utf-8",
        Authorization: global.token,
      },
    });
    if (!resp.ok) {
      console.error(`Error at fetching the Musics: ${resp.statusText}`);
      return;
    } else {
      const data = await resp.json();
      global.set_title = data.title.replace(/[\/\\?%*:|"<>]/g, "");
      global.set_id = data.id;
      setTracks = data.tracks.map((track) => track.id);
    }
  }
  ensureDirectoryExistence(`${global.filePath}/sets/${global.set_title}`);
  return setTracks;
}

async function getTrack(url) {
  try {
    let resp = await fetch(`https://api-v2.soundcloud.com/resolve?url=${url}`, {
      method: "GET",
      headers: {
        Authorization: global.token,
      },
    });
    if (!resp.ok) {
      console.warn(`Failed to fetch song data for track ID: ${url}`);
      return null; // Retorna null se a requisição falhar
    }
    const data = await resp.json();
    return data.media.transcodings[1].url;
  } catch (err) {
    console.error(err);
    return null;
  }
}

// Save the set data in to the sets folder
async function storeSet(url) {
  // Gets the set tracks ids
  const setTracks = await getSet(url);
  // Gets the info of each track and saves in data
  let data = await getSetTracks(setTracks);

  const path = `${global.filePath}/sets/${global.set_title}/${global.set_title}.json`;
  // Filter null values for not found tracks
  data = data.filter((track) => track !== null);
  const jsonString = JSON.stringify(data, null, 2);
  console.log(path);
  // Read the older file of the track to generate a log of what is removed and what is added, otherwise create a new file
  try {
    let oldData = fs.readFileSync(path, "utf-8");
    const jsonOldData = JSON.parse(oldData);
    let log = await compareData(data, jsonOldData);
    generateLog(data.length, log);
  } catch (e) {
    console.log("Creating new set file");
    await generateLog(data.length, "");
  }
  // Save and filter the new tracks into the cache
  global.cache = global.cache.concat(data);
  await setCache();
  // Save the new set data in to the set folder as json file
  fs.writeFileSync(path, jsonString, (err) => {
    if (err) {
      console.error(err);
      return;
    } else {
      console.log(
        `Set ${global.set_title} saved successfully: ${data.length} songs out of ${setTracks.length}\n`
      );
    }
  });
}

// Get info of all the tracks in the ids array
async function getSetTracks(ids) {
  let start = 0;
  let finalData = [];
  // ideia
  // let filteredData = global.cache.filter((data) => ids.includes(data.id));
  // ids = ids.filter((id) => !global.cache.find((data) => data.id === id));
  // if (filteredData.length > 0) finalData.push(filteredData);
  while (start < ids.length) {
    const result = ids.slice(start, start + 50).join("%2C");
    let url = `
    https://api-v2.soundcloud.com/tracks?ids=${result}&client_id=${global.client_id}`;
    let resp = await fetch(`${url}`, {
      method: "GET",
      headers: {
        accept: "application/json; charset=utf-8",
        Authorization: global.token,
      },
    });
    if (!resp.ok) {
      console.error(`Error fetching tracks: ${resp.statusText}`);
      return;
    }
    let data = await resp.json();
    data = await Promise.all(
      data.map(async (track) => await formatedTrack(track))
    );
    finalData.push(...data);
    start += 50;
  }
  return finalData;
}

// Gets a id of a set user or track from his url
async function getIdByUrl(url) {
  let resp = await fetch(`https://api-v2.soundcloud.com/resolve?url=${url}`, {
    headers: {
      accept: "*/*",
      Authorization: token,
    },
  });
  if (resp.status === 404) {
    console.error("Track not found");
  } else {
    let data = await resp.json();
    return data.id; // Track ID returned
  }
}

async function selectWhere(condition, type) {
  const filteredSets = global.cache.filter(
    (x) => getNestedValue(x, type) === condition
  );
  console.log(
    `Tracks that match the condition: ${filteredSets.length}` // JSON.stringify(filteredSets, null, 2)
  );
  return filteredSets;
}

function getNestedValue(obj, dirPath) {
  return dirPath.split(".").reduce((acc, part) => acc && acc[part], obj);
}

// pip install youtube-dl
// async function downloadSoundCloudAsMp3(url) {
//   // Make name = username - trackname
//   let name = url.split("/");
//   name = `${name[3]} - ${name[4].replace(/-/g, " ")}`;
//   //output directory/name
//   const output = `privateapplicationmanager/mp3/${name}`;
//   // Check if the music already exists in the output directory
//   // if (fs.existsSync(`${output}.mp3`)) {
//   //   console.log(`Music ${name} already exists in ${output}.mp3`);
//   //   return;
//   // }
//   // youtube-dl command
//   const command = `youtube-dl --extract-audio --audio-format mp3 -o "${output}.%(ext)s" ${url}`;
//   // Execute command
//   exec(command, (error, stdout, stderr) => {
//     if (error) {
//       //console.error(`Erro: ${error.message}`);
//       return;
//     }
//     if (stderr) {
//       //console.error(`stderr: ${stderr}`);
//       return;
//     }
//     //console.log(`stdout: ${stdout}`);
//   });
//   console.log(command);
// }

async function downloadTrack(url) {
  try {
    // Obter informações sobre a faixa
    let name = url.split("/");
    name = `${name[3]} - ${name[4].replace(/-/g, " ")}`;
    const directory = `${global.filePath}/mp3`;
    ensureDirectoryExistence(directory);
    if (fs.existsSync(`${directory}/${name}.mp3`)) {
      console.log(`Music ${name} already exists in ${directory}/${name}.mp3`);
      return;
    }
    console.log(`Donwloading: ${name}`);
    // Fazer o download e salvar o arquivo
    const stream = await downloadMP3(url);
    const writeStream = fs.createWriteStream(`${directory}/${name}.mp3`);

    stream.pipe(writeStream);

    writeStream.on("finish", () => {
      console.log(`Finished: ${name}`);
    });
  } catch (error) {
    console.error(`Failed to Download the track ${name}:`, error);
  }
}

async function downloadSet(url) {
  let tracks;
  await getSet(url);
  let dirPath = `${global.filePath}/sets/${global.set_title}/${global.set_title}.json`;
  try {
    tracks = JSON.parse(fs.readFileSync(dirPath, "utf8"));
  } catch (error) {
    console.error("File not found: " + dirPath);
    await storeSet(url);
    await downloadSet(url);
    return;
  }
  tracks = tracks.map((track) => track.permalink_url);
  for (let url of tracks) {
    await downloadTrack(url);
  }
  console.log(`Set Download Finished`);
}

async function addTrackToSet(trackId, setUrl) {
  const setTracks = await getSet(setUrl);
  setTracks.push(trackId);
  let resp = await fetch(global.apiPath + `sets/${setId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: global.token,
    },
    body: JSON.stringify({
      playlist: {
        tracks: setTracks,
      },
    }),
  });
  console.log(`Status: ${resp.status} ${resp.statusText} --> url: ${resp.url}`);
}

async function removeTrackFromSet(trackId, setUrl) {
  const setTracks = await getSet(setUrl);
  setTracks = setTracks.filter((track) => track !== trackId);
  let resp = await fetch(global.apiPath + `sets/${global.set_id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: global.token,
    },
    body: JSON.stringify({
      playlist: {
        tracks: setTracks,
      },
    }),
  });
  console.log(`Status: ${resp.status} ${resp.statusText} --> url: ${resp.url}`);
}

// Init and than download everything from all sets and from likes
// If just want to store everything just substitute the downloadSet with the storeSet function
async function downloadFullLibrary() {
  await init().then(async () => {
    for (set of global.sets) {
      await downloadSet(set);
    }
    await downloadSet();
  });
}

async function getFullLibrary() {
  for (set of global.sets) {
    await storeSet(set);
  }
  await storeSet();
  console.log("all librarires saved");
}

async function downloadMP3(trackUrl) {
  const data = await getMediaUrl(trackUrl);
  const response = await axios({
    url: data,
    method: "GET",
    responseType: "stream",
  });
  return response.data;
}

async function getMediaUrl(trackUrl) {
  const url = await getTrack(trackUrl);
  let resp = await fetch(`${url}?client_id=${global.client_id}`, {
    method: "GET",
    headers: {
      accept: "*/*",
      Authorization: global.token,
    },
  });
  let data = await resp.json();
  return data.url;
}

// init().then(async () => {
//   await downloadTrack(
//     "https://soundcloud.com/dang000/mariya-chaykovskaya-kiss-me-dang-remix"
//   );
// });

// async function getTrackInfo(trackUrl, clientId) {
//   console.log(trackUrl);
//   console.log(clientId);
//   const apiUrl = `https://api-v2.soundcloud.com/resolve?url=${trackUrl}&client_id=${clientId}`;
//   const response = await axios.get(apiUrl); // Aqui você obterá o objeto JSON com todas as informações da música
//   console.log(response.data.media);
// }

// init().then(async () => {
//   await getTrackInfo(
//     "https://soundcloud.com/dang000/mariya-chaykovskaya-kiss-me-dang-remix",
//     global.client_id
//   );
// });

//getFullLibrary();

async function logOut() {
  let resp = await fetch(
    `https://api-auth.soundcloud.com/sign-out?client_id=${global.client_id}`,
    {
      method: "POST",
      body: JSON.stringify({
        access_token: global.token.split("OAuth ")[1],
      }),
    }
  );
  console.log(resp);
  global.token = null;
}

module.exports = {
  downloadTrack,
  downloadSet,
  addTrackToSet,
  removeTrackFromSet,
  downloadFullLibrary,
  getSet,
  selectWhere,
  getIdByUrl,
  init,
  setCache,
  storeSet,
  getFullLibrary,
  setAuthorizationToken,
  logOut,
};
