// Lets tablets and other screens on the rink's network reach the desktop app.
//
// The desktop app's own server listens only on this computer (127.0.0.1), because sign-in is
// off there and every request it gets is treated as the owner. This adds a second listener,
// on the network, that hands its connections to the same server. Requests that arrive through
// it are never treated as the owner: they can open share links, and a second operator can sign
// in with a link and PIN, the same as on the website.
import { createServer as createNetServer, type Server as NetServer, type Socket as NetSocket } from "net";
import { networkInterfaces } from "os";
import type { IncomingHttpHeaders, Server as HttpServer } from "http";

/** The parts of a request this looks at. Express, Socket.IO and the CORS middleware each have their own request type. */
interface RequestLike {
  socket?: unknown;
  headers: IncomingHttpHeaders;
}

/** The port tried first, so a link saved on a tablet keeps working from one game to the next. */
export const DEFAULT_LAN_PORT = 3696;

/**
 * This computer's addresses on its local networks, the most likely one for a rink's wifi or a
 * hotspot first.
 */
export function lanAddresses(interfaces = networkInterfaces()): string[] {
  const addresses: string[] = [];
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) addresses.push(entry.address);
    }
  }
  const rank = (address: string) => {
    if (address.startsWith("192.168.")) return 0;
    if (address.startsWith("10.")) return 1;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) return 2;
    // Self-assigned, when there's no router handing out addresses.
    if (address.startsWith("169.254.")) return 4;
    return 3;
  };
  return [...new Set(addresses)].sort((a, b) => rank(a) - rank(b));
}

const OWNER_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface LanAccess {
  /** Whether a request came from this computer, through its own listener, by a name for this computer. */
  isOwnerRequest(request: RequestLike): boolean;
  /** Whether a request came in through the network listener. */
  isLanRequest(request: RequestLike): boolean;
  isOn(): boolean;
  /** The port the network listener is on, or null when it's off. */
  port(): number | null;
  start(): Promise<number>;
  stop(): Promise<void>;
}

export function createLanAccess({
  httpServer,
  preferredPort = DEFAULT_LAN_PORT,
}: {
  httpServer: HttpServer;
  preferredPort?: number;
}): LanAccess {
  // Every connection the network listener accepts. A WeakSet, so a closed one is forgotten.
  const lanSockets = new WeakSet<NetSocket>();
  const open = new Set<NetSocket>();
  let listener: NetServer | null = null;
  let listeningPort: number | null = null;

  const listen = (server: NetServer, port: number) =>
    new Promise<number>((resolve, reject) => {
      const onError = (error: Error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        const address = server.address();
        resolve(typeof address === "object" && address ? address.port : port);
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, "0.0.0.0");
    });

  return {
    isOwnerRequest(request) {
      if (lanSockets.has(request.socket as NetSocket)) return false;
      // The Host check stops a web page that points its own domain at 127.0.0.1 from
      // reaching the owner's controls through this computer's browser.
      const host = request.headers.host ?? "";
      const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
      return OWNER_HOSTNAMES.has(hostname.toLowerCase());
    },

    isLanRequest(request) {
      return lanSockets.has(request.socket as NetSocket);
    },

    isOn: () => listener !== null,

    port: () => listeningPort,

    async start() {
      if (listener && listeningPort !== null) return listeningPort;
      const server = createNetServer((socket) => {
        lanSockets.add(socket);
        open.add(socket);
        socket.once("close", () => open.delete(socket));
        // The HTTP server reads the request from here, WebSocket upgrades included.
        httpServer.emit("connection", socket);
      });
      let port: number;
      try {
        port = await listen(server, preferredPort);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE" || preferredPort === 0) throw error;
        // Something else has the usual port, so take any free one. Links then change for this launch.
        port = await listen(server, 0);
      }
      listener = server;
      listeningPort = port;
      return port;
    },

    async stop() {
      const server = listener;
      listener = null;
      listeningPort = null;
      if (!server) return;
      // Screens on the network are cut off straight away, not when they next disconnect.
      for (const socket of open) socket.destroy();
      open.clear();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
