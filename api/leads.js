const MAX_QUERY_LENGTH = 120;
const MAX_RESULTS = 20;

function cleanText(value) {
  return String(value || '').trim().slice(0, MAX_QUERY_LENGTH);
}

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Método não permitido.' });
  }
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return response.status(503).json({ error: 'A busca ainda não foi configurada no servidor.' });
  }
  const city = cleanText(request.body?.city);
  const category = cleanText(request.body?.category);
  if (!city || !category) {
    return response.status(400).json({ error: 'Informe cidade e ramo do negócio.' });
  }
  try {
    const placesResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.businessStatus'
      },
      body: JSON.stringify({ textQuery: `${category} em ${city}`, languageCode: 'pt-BR', maxResultCount: MAX_RESULTS })
    });
    const payload = await placesResponse.json();
    if (!placesResponse.ok) {
      console.error('Google Places request failed', placesResponse.status);
      return response.status(502).json({ error: 'O Google Places recusou a consulta. Confira a chave e a API habilitada.' });
    }
    const leads = (payload.places || []).filter(place => place.businessStatus !== 'CLOSED_PERMANENTLY').map(place => ({
      name: place.displayName?.text || 'Negócio sem nome', address: place.formattedAddress || city,
      phone: place.nationalPhoneNumber || '', website: place.websiteUri || '', mapsUrl: place.googleMapsUri || ''
    }));
    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({ leads });
  } catch (error) {
    console.error('Google Places request error', error?.message);
    return response.status(500).json({ error: 'Não foi possível consultar o Google Places agora.' });
  }
};
