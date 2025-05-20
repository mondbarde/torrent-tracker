import { useState, useEffect } from 'react';
import { Search, Download, RefreshCw, Info, Shield, Globe, Database } from 'lucide-react';

export default function TorrentTrackerApp() {
  const [infoHash, setInfoHash] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('search');

  const validateInfoHash = (hash) => {
    // Basic validation for info hash format (40 hex characters)
    const hexRegex = /^[a-fA-F0-9]{40}$/;
    return hexRegex.test(hash);
  };

  const searchPeers = () => {
    if (!validateInfoHash(infoHash)) {
      setError('유효한 Info Hash를 입력해주세요 (40자 16진수)');
      return;
    }

    setIsLoading(true);
    setError('');
    
    // Simulate API call
    setTimeout(() => {
      // This would be an actual API call in production
      const mockResults = {
        infoHash: infoHash,
        timestamp: new Date().toISOString(),
        trackerResponses: [
          { 
            tracker: 'udp://tracker.opentrackr.org:1337',
            peers: 124,
            seeders: 87,
            leechers: 37
          },
          { 
            tracker: 'udp://tracker.leechers-paradise.org:6969',
            peers: 98,
            seeders: 65, 
            leechers: 33
          },
        ],
        dhtResponses: 215,
        peerList: [
          { ip: '203.0.113.1', port: 51413, source: 'DHT', country: 'United States', isp: 'Comcast' },
          { ip: '198.51.100.2', port: 6881, source: 'Tracker', country: 'Germany', isp: 'Deutsche Telekom' },
          { ip: '198.51.100.3', port: 6881, source: 'Tracker', country: 'France', isp: 'Orange' },
          { ip: '203.0.113.4', port: 51413, source: 'DHT', country: 'Japan', isp: 'NTT' },
          { ip: '198.51.100.5', port: 6881, source: 'Tracker', country: 'United Kingdom', isp: 'BT' },
          { ip: '203.0.113.6', port: 51413, source: 'DHT', country: 'Canada', isp: 'Bell' },
          { ip: '198.51.100.7', port: 6881, source: 'Tracker', country: 'Italy', isp: 'Telecom Italia' },
          { ip: '203.0.113.8', port: 51413, source: 'DHT', country: 'Brazil', isp: 'Vivo' },
          { ip: '198.51.100.9', port: 6881, source: 'Tracker', country: 'Australia', isp: 'Telstra' },
          { ip: '203.0.113.10', port: 51413, source: 'DHT', country: 'South Korea', isp: 'SK Telecom' },
          { ip: '198.51.100.11', port: 6881, source: 'Tracker', country: 'Spain', isp: 'Telefonica' },
          { ip: '203.0.113.12', port: 51413, source: 'DHT', country: 'Russia', isp: 'Rostelecom' }
        ],
        totalPeers: 437,
        uniqueIPs: 312,
      };
      
      setResults(mockResults);
      setIsLoading(false);
    }, 2000);
  };

  const downloadResults = () => {
    if (!results) return;
    
    // Create CSV content
    let csvContent = "IP,Port,Source,Country,ISP\n";
    results.peerList.forEach(peer => {
      csvContent += `${peer.ip},${peer.port},${peer.source},${peer.country},${peer.isp}\n`;
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `peers_${infoHash.substring(0, 8)}_${new Date().toISOString().split('T')[0]}.csv`);
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-800 text-white p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Shield className="w-8 h-8" />
            <h1 className="text-2xl font-bold">TorrentTracker</h1>
          </div>
          <nav>
            <ul className="flex space-x-6">
              <li 
                className={`cursor-pointer hover:text-blue-200 ${activeTab === 'search' ? 'border-b-2 border-white' : ''}`}
                onClick={() => setActiveTab('search')}
              >
                검색
              </li>
              <li 
                className={`cursor-pointer hover:text-blue-200 ${activeTab === 'dashboard' ? 'border-b-2 border-white' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                대시보드
              </li>
              <li 
                className={`cursor-pointer hover:text-blue-200 ${activeTab === 'reports' ? 'border-b-2 border-white' : ''}`}
                onClick={() => setActiveTab('reports')}
              >
                보고서
              </li>
              <li 
                className={`cursor-pointer hover:text-blue-200 ${activeTab === 'settings' ? 'border-b-2 border-white' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                설정
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-6xl mx-auto w-full p-6">
        {activeTab === 'search' && (
          <>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">토렌트 Info Hash로 피어 검색</h2>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-grow">
                  <input 
                    type="text" 
                    value={infoHash} 
                    onChange={(e) => setInfoHash(e.target.value)}
                    placeholder="Info Hash를 입력하세요 (40자 16진수)"
                    className="w-full p-3 border border-gray-300 rounded"
                  />
                  {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
                </div>
                <button 
                  onClick={searchPeers} 
                  disabled={isLoading} 
                  className="bg-blue-600 text-white px-6 py-3 rounded flex items-center justify-center min-w-40"
                >
                  {isLoading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Search className="w-5 h-5 mr-2" />
                      피어 검색
                    </>
                  )}
                </button>
              </div>
            </div>

            {results && (
              <div className="bg-white rounded-lg shadow">
                <div className="border-b border-gray-200 p-4 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium">검색 결과: {results.infoHash}</h3>
                    <p className="text-gray-500 text-sm">검색 시간: {new Date(results.timestamp).toLocaleString()}</p>
                  </div>
                  <button 
                    onClick={downloadResults}
                    className="bg-green-600 text-white px-4 py-2 rounded flex items-center text-sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    CSV 다운로드
                  </button>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center mb-2">
                      <Globe className="w-5 h-5 text-blue-600 mr-2" />
                      <h4 className="font-medium">피어 통계</h4>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">총 피어:</span>
                        <span className="font-semibold">{results.totalPeers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">고유 IP:</span>
                        <span className="font-semibold">{results.uniqueIPs}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">트래커 응답:</span>
                        <span className="font-semibold">{results.trackerResponses.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">DHT 응답:</span>
                        <span className="font-semibold">{results.dhtResponses}</span>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center mb-2">
                      <Database className="w-5 h-5 text-blue-600 mr-2" />
                      <h4 className="font-medium">피어 목록 (최근 12개)</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">포트</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">출처</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">국가</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ISP</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {results.peerList.map((peer, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2 whitespace-nowrap text-sm">{peer.ip}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm">{peer.port}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm">
                                <span className={`px-2 py-1 rounded text-xs ${peer.source === 'DHT' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                  {peer.source}
                                </span>
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm">{peer.country}</td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm">{peer.isp}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab !== 'search' && (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <Info className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">이 기능은 프로토타입에서 사용할 수 없습니다</h3>
            <p className="text-gray-500">
              현재 검색 기능만 구현되어 있습니다. 다른 기능은 향후 업데이트에서 제공될 예정입니다.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-100 border-t border-gray-200 py-4">
        <div className="max-w-6xl mx-auto px-4">
          <p className="text-center text-gray-600 text-sm">
            © 2025 TorrentTracker - 기업용 토렌트 모니터링 솔루션
          </p>
        </div>
      </footer>
    </div>
  );
}