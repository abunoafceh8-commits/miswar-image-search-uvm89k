export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.json({
    sources: [
      { id: 'openverse', name: 'Openverse', description: 'Creative Commons images', active: true },
      { id: 'wikimedia', name: 'Wikimedia Commons', description: 'Free media repository', active: true },
      { id: 'flickr', name: 'Flickr', description: 'Photo sharing platform', active: true },
      { id: 'smithsonian', name: 'Smithsonian', description: 'Institution collections', active: true },
      { id: 'europeana', name: 'Europeana', description: 'European cultural heritage', active: true },
    ]
  });
}
