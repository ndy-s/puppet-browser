# Puppet Browser
<p>
  <img src="https://github.com/ndy-s/puppet-browser/blob/main/assets/puppet-browser-icon.png" alt="Puppet Browser Logo" width="150" height="150" style="vertical-align: middle; margin-right: 15px;">
  <blockquote style="display: inline; font-size: 1.2em; margin: 0;">
    “A browser you can control from anywhere.”
  </blockquote>
</p>

This repo is a small project I made out of curiosity about how remote desktop connections work. I wanted to see if I could make something similar, but just for a browser. The name "Puppet Browser" comes from the idea that the browser acts like a puppet you can control remotely. It uses [Puppeteer](https://pptr.dev/) as the foundation to run and control the browser programmatically.

It's very lightweight and experimental, basically a learning playground for me, but it works for controlling a browser remotely in a smaller scope.

## What It Does?
It launches a browser that you can connect to from another PC. You can see the browser screen in real-time and send keyboard and mouse input, so it feels like you're using a normal browser. I tried to keep the code minimal and understandable, so you can peek under the hood and see how everything works.

### My Use Case
I use this on my local network with two PCs connected over LAN. One PC has internet access, while the other doesn't. Using this setup, the PC without internet can still control and access a browser running on the PC that does. It's perfect for private LAN networks or small setups like mine, giving the offline PC a fully functional browser without needing direct internet access.

## Quick Setup
Clone the repo and install dependencies:
```bash
git clone https://github.com/ndy-s/puppet-browser.git
cd puppet-browser
npm install
```

Start the server:
```bash
npm run start
```

Open your browser and go to:
```
http://localhost:3000
```
You can now control the browser remotely.

<img src="https://raw.githubusercontent.com/ndy-s/puppet-browser/main/assets/preview.gif" alt="Puppet Browser Demo">

## How It Works?
At first, I thought it would be easy to just embed a browser in an iframe, but many sites including Google services prevent that for security reasons. So I had to find another way, and that's when I discovered Puppeteer, which is usually used for automated browser testing. The server launches a Chromium browser (or Chrome, if installed) in the background using Puppeteer. I use [chrome-launcer](https://www.npmjs.com/package/chrome-launcher) to detect if Chrome is installed. If not, it falls back to the bundled Chromium from .

### Screenshot Capture & Streaming
Here's roughly how it works. The  browser runs in the background and loads the pages you want to use. The server captures screenshots periodically and sends those images to the client using [Socket.IO](https://socket.io/). The capture loop runs about every 100 milliseconds, which usually gives a frame rate between 5 and 10 frames per second depending on the page and network.

<img src="https://raw.githubusercontent.com/ndy-s/puppet-browser/main/assets/diagram.png" alt="System Diagram" width="500">

> [!NOTE]
> Using 100 ms isn't mandatory. For me, it's just a good balance between performance and smoothness. Feel free to tune it as you like.

It's not super fast, but it works well enough for my LAN setup. A faster solution could be possible using [WebRTC](https://webrtc.org/) for streaming, which would make the visuals smoother and more responsive. But I don't want to overcomplicate this project, so I'll stick with Socket.IO for now.

I also added automatic recovery for streaming. If the browser crashes or an error occurs while transmitting images to the client, the server doesn't fail completely. Instead, it automatically recovers and restarts the necessary processes on the browser side, so your remote session can continue without manual intervention.

### Input Handling
When you type or click on the client, those events are sent back to the server and executed in the  browser. The client listens for different input events, including mouse movements, mouse button presses and releases, scrolling, and keyboard key presses and releases. Each event is captured in real-time and transmitted via Socket.IO to the server, which then performs the corresponding action in the  browser. This makes it feel like you are controlling a normal browser even though it's running on another PC. You can see the full implementation of these input event listeners in the [`control.js`](https://github.com/ndy-s/puppet-browser/blob/main/public/js/control.js) file.

### Clipboard Support
But then it only works internally on the server remote browser. So how can we copy across the client and the remote server? What I did is intercept the event listeners to handle specific key combinations. For example, pressing `Ctrl + V` will run a process to paste the current client clipboard into the browser screen, and `Ctrl + C` works similarly.

> [!CAUTION]
> This requires permission from your browser, so you need to accept the confirmation when it appears.

It turns out clipboard access only works reliably on `https` or `localhost`. If automatic copy/paste doesn’t work, a manual popup will show up asking you to paste or copy the content. Just follow the instructions in the popup and it should work. Even with permissions, some browsers can still block clipboard actions in certain situations, so having this manual fallback makes sure everything runs smoothly.

### Action Queue
Another challenge I faced is that event listeners and Socket.IO emit/on events are not executed sequentially. Actions might overlap if sent at the same time. To fix this, I implemented a [`queue.js`](https://github.com/ndy-s/puppet-browser/blob/main/lib/queue.js), where all actions are recorded and processed sequentially.

There is also a simple button interface that represents browser controls like back, forward, and refresh.  often breaks its internal history, so I manage it manually. I use stacks for both back and forward functions, where I can push and pop history events as they happen. You can check the implementation in [`browser.js`](https://github.com/ndy-s/puppet-browser/blob/main/lib/browser.js).

### Browser Flow
Currently, the app works with a shared browser. Each user session must wait in the queue to use the remote browser, and the queue decides who can control it at a given time. The browser state is shared across all users, which avoids consuming a lot of memory if each user had their own browser instance.

The app focuses on a single tab for simplicity. Sometimes a page action opens a new tab, which I handle by automatically switching focus to the new tab and closing the previous one. Multi-tab management isn't supported yet, and the queue ensures only one user controls the browser at a time.

## Limitations
This project is primarily an experiment and a learning playground, so it's not perfect. There may still be bugs or unexpected behavior, and some features are limited. It's not designed or tested for production use, so use it at your own risk. 

Any contributions, suggestions, or improvements are very welcome and appreciated!

## License
MIT
