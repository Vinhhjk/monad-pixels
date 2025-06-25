// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract TestPixelNFT1 is ERC721 {
    uint256 public constant WIDTH = 100;
    uint256 public constant HEIGHT = 100;
    mapping(uint256 => string) public pixelColors;
    uint256 private _totalMinted = 0;
    
    // Add default color constant
    string public constant DEFAULT_COLOR = "#ffffff";

    // Add custom event for color updates
    event ColorUpdated(uint256 indexed tokenId, uint256 indexed x, uint256 indexed y, string color, address owner);

    constructor() ERC721("PixelNFT", "PXNFT") {}

    // Add color validation function
    function _validateAndNormalizeColor(string memory color) internal pure returns (string memory) {
        bytes memory colorBytes = bytes(color);
        
        // Check if empty or too short
        if (colorBytes.length == 0) {
            return DEFAULT_COLOR;
        }
        
        // Must start with #
        if (colorBytes[0] != 0x23) { // 0x23 is '#' in hex
            return DEFAULT_COLOR;
        }
        
        // Check valid lengths: #RGB (4 chars) or #RRGGBB (7 chars)
        if (colorBytes.length != 4 && colorBytes.length != 7) {
            return DEFAULT_COLOR;
        }
        
        // Validate hex characters
        for (uint256 i = 1; i < colorBytes.length; i++) {
            bytes1 char = colorBytes[i];
            if (!(char >= 0x30 && char <= 0x39) && // 0-9
                !(char >= 0x41 && char <= 0x46) && // A-F
                !(char >= 0x61 && char <= 0x66)) { // a-f
                return DEFAULT_COLOR;
            }
        }
        
        // Convert 3-char hex to 6-char hex if needed
        if (colorBytes.length == 4) {
            return string(abi.encodePacked(
                "#",
                colorBytes[1], colorBytes[1],
                colorBytes[2], colorBytes[2],
                colorBytes[3], colorBytes[3]
            ));
        }
        
        return color;
    }

    function _getTokenId(uint256 x, uint256 y) public pure returns (uint256) {
        require(x < WIDTH && y < HEIGHT, "Out of bounds");
        return y * WIDTH + x;
    }

    function mint(uint256 x, uint256 y, string memory color) external {
        uint256 tokenId = _getTokenId(x, y);
        require(!_exists(tokenId), "Pixel already owned");
        
        // Validate and normalize color
        string memory validColor = _validateAndNormalizeColor(color);
        
        _mint(msg.sender, tokenId);
        _totalMinted++;
        pixelColors[tokenId] = validColor;
        
        emit ColorUpdated(tokenId, x, y, validColor, msg.sender);
    }
    
    function batchMint(uint256[] memory x, uint256[] memory y, string[] memory colors) external {
        require(x.length == y.length && y.length == colors.length, "Arrays length mismatch");
        require(x.length > 0, "Empty arrays");
        
        for (uint256 i = 0; i < x.length; i++) {
            uint256 tokenId = _getTokenId(x[i], y[i]);
            require(!_exists(tokenId), "Pixel already owned");
            
            // Validate and normalize color
            string memory validColor = _validateAndNormalizeColor(colors[i]);
            
            _mint(msg.sender, tokenId);
            _totalMinted++;
            pixelColors[tokenId] = validColor;
            
            emit ColorUpdated(tokenId, x[i], y[i], validColor, msg.sender);
        }
    }
    
    function updateColor(uint256 x, uint256 y, string memory color) external {
        uint256 tokenId = _getTokenId(x, y);
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        
        // Validate and normalize color
        string memory validColor = _validateAndNormalizeColor(color);
        pixelColors[tokenId] = validColor;
        
        emit ColorUpdated(tokenId, x, y, validColor, msg.sender);
    }

    function getColor(uint256 x, uint256 y) external view returns (string memory) {
        uint256 tokenId = _getTokenId(x, y);
        return pixelColors[tokenId];
    }
    
    function getPixelData(uint256 x, uint256 y) external view returns (address owner, string memory color, bool isMinted) {
        uint256 tokenId = _getTokenId(x, y);
        
        if (_exists(tokenId)) {
            return (ownerOf(tokenId), pixelColors[tokenId], true);
        } else {
            return (address(0), "", false);
        }
    }
    
    function getMintedPixelsInRange(uint256 startX, uint256 startY, uint256 endX, uint256 endY) 
        external view returns (uint256[] memory tokenIds, address[] memory owners, string[] memory colors) {
        
        require(startX <= endX && startY <= endY, "Invalid range");
        require(endX < WIDTH && endY < HEIGHT, "Range out of bounds");
        
        uint256 rangeSize = (endX - startX + 1) * (endY - startY + 1);
        require(rangeSize <= 50, "Range too large");
        
        uint256[] memory tempTokenIds = new uint256[](rangeSize);
        address[] memory tempOwners = new address[](rangeSize);
        string[] memory tempColors = new string[](rangeSize);
        uint256 count = 0;
        
        for (uint256 y = startY; y <= endY; y++) {
            for (uint256 x = startX; x <= endX; x++) {
                uint256 tokenId = _getTokenId(x, y);
                
                if (_exists(tokenId)) {
                    tempTokenIds[count] = tokenId;
                    tempOwners[count] = ownerOf(tokenId);
                    tempColors[count] = pixelColors[tokenId];
                    count++;
                }
            }
        }
        
        tokenIds = new uint256[](count);
        owners = new address[](count);
        colors = new string[](count);
        
        for (uint256 i = 0; i < count; i++) {
            tokenIds[i] = tempTokenIds[i];
            owners[i] = tempOwners[i];
            colors[i] = tempColors[i];
        }
        
        return (tokenIds, owners, colors);
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Nonexistent token");

        string memory color = pixelColors[tokenId];
        // Fallback to default color if somehow empty
        if (bytes(color).length == 0) {
            color = DEFAULT_COLOR;
        }
        
        string memory x = Strings.toString(tokenId % WIDTH);
        string memory y = Strings.toString(tokenId / WIDTH);

        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">',
            '<rect width="100" height="100" fill="', color, '" />',
            '</svg>'
        ));

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{',
                            '"name": "Pixel (', x, ',', y, ')",',
                            '"description": "A pixel on the onchain canvas.",',
                            '"image": "data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
                            '"attributes": [',
                                '{"trait_type": "X", "value": ', x, '},',
                                '{"trait_type": "Y", "value": ', y, '},',
                                '{"trait_type": "Color", "value": "', color, '"}',
                            ']'
                        '}'
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }
    
    function totalMinted() external view returns (uint256) {
        return _totalMinted;
    }
}
