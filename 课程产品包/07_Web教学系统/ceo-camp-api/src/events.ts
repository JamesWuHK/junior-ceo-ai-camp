import type { JsonValue, SseClient } from "./types.js";

const clients = new Map<string, SseClient>();

export function addClient(client: SseClient) {
  clients.set(client.id, client);
}

export function removeClient(id: string) {
  clients.delete(id);
}

export function broadcast(event: string, data: JsonValue) {
  for (const client of clients.values()) {
    client.write(event, data);
  }
}

export function clientCount() {
  return clients.size;
}
