/**
 * THE DIRECTORY CHECKER
 * Run this to see which AI models your key can actually talk to.
 */
function runDiscovery() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const desks = ['v1', 'v1beta'];
  
  desks.forEach(deskName => {
    const url = `https://generativelanguage.googleapis.com/${deskName}/models?key=${apiKey}`;
    
    try {
      const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const status = response.getResponseCode();
      const info = JSON.parse(response.getContentText());
      
      console.log(`--- Checking Desk: ${deskName} ---`);
      
      if (status === 200 && info.models) {
        console.log(`Success! Your key works here. You can use these names:`);
        // This prints the exact names Google recognizes
        info.models.forEach(item => console.log(item.name));
      } else {
        console.log(`Desk ${deskName} said no. Reason: ${response.getContentText()}`);
      }
    } catch (e) {
      console.log(`Couldn't reach Desk ${deskName}: ${e.toString()}`);
    }
  });
}