'use strict';
(function synapseRelayDefaultEndpoint() {
	const encodedReversedHost = 'dmVkLnNyZWtyb3cuYXZlZWlubmlyZGVwLnlhbGVyLWFyb3J1YQ==';

	                                                                        
	                                                         
	                                                                    
	                                                                     
	                                                                        
	                               
	const BRAND = 'synapse-mcp';
	const STORAGE_KEY = 'synapse.mcp.host';

	function sanitizeHost(value) {
		const host = String(value || '')
			.trim()
			.replace(/^[a-z]+:\/\//i, '')
			.replace(/\/.*$/, '')
			.replace(/\s+/g, '');
		                                                                 
		return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(host)
			? host.toLowerCase()
			: '';
	}

	function overrideHost() {
		try {
			const inline = sanitizeHost(window.SYNAPSE_MCP_HOST);
			if (inline) return inline;
		} catch (error) {
			              
		}
		try {
			return sanitizeHost(localStorage.getItem(STORAGE_KEY));
		} catch (error) {
			return '';
		}
	}

	function publishedHost() {
		return atob(encodedReversedHost).split('').reverse().join('');
	}

	function defaultRelayHost() {
		return overrideHost() || publishedHost();
	}

	function defaultRelayOrigin() {
		return 'https://' + defaultRelayHost();
	}

	                                                                     
	function brandRelayHostSuggestion() {
		const parts = publishedHost().split('.');
		if (parts.length < 2) return '';
		parts[0] = BRAND;
		return parts.join('.');
	}

	window.SynapseRelayDefaultEndpoint = Object.freeze({
		brand: BRAND,
		storageKey: STORAGE_KEY,
		sanitizeHost: sanitizeHost,
		defaultRelayHost: defaultRelayHost,
		defaultRelayOrigin: defaultRelayOrigin,
		brandRelayHostSuggestion: brandRelayHostSuggestion,
	});
})();
