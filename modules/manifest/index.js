class Manifest {
    constructor(manifest_url, payload) {
        this.manifest_url = manifest_url;
        this.payload = payload;
    }

    to_dict() {
        return {
            manifestUrl: this.manifest_url,
            items: [
                {
                    "name": "ton_addr"
                }
            ]
        };
    }
}

module.exports = Manifest;