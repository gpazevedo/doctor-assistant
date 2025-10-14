interface JwtHeader {
    alg: string;
    typ: string;
    [key: string]: unknown;
}
  
interface JwtPayload {
    sub: string;
    iat: number;
    exp: number;
    [key: string]: unknown;
}

export default function decodeJwt(token: string): { header: JwtHeader; payload: JwtPayload } | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
        }

        const headerBase64Url = parts[0];
        const payloadBase64Url = parts[1];

        // Decode Base64Url to Base64, then decode Base64 to string
        const headerDecoded = JSON.parse(atob(headerBase64Url.replace(/-/g, '+').replace(/_/g, '/')));
        const payloadDecoded = JSON.parse(atob(payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/')));

        return { header: headerDecoded, payload: payloadDecoded };
    } catch (error) {
        console.error('Error decoding JWT:', error);
        return null;
    }
}