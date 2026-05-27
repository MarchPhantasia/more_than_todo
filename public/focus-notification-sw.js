self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const visibleClient = clientList.find((client) => "focus" in client);
        if (visibleClient) {
          return visibleClient.focus();
        }
        return self.clients.openWindow("/");
      })
  );
});
