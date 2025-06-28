// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestPixelNFT20 is ERC721, Ownable {
    uint256 public constant WIDTH = 100;
    uint256 public constant HEIGHT = 100;
    mapping(uint256 => string) public pixelColors;
    uint256 private _totalMinted = 0;
    
    // Add default color constant
    string public constant DEFAULT_COLOR = "#ffffff";
    
    // Collection info
    string public collectionDescription = "A collaborative pixel art canvas where each pixel is an NFT. Create art together on-chain!";
    string public externalUrl = "https://pixels.monadfrens.fun";

    // Add custom event for color updates
    event ColorUpdated(uint256 indexed tokenId, uint256 indexed x, uint256 indexed y, string color, address owner);

    constructor() ERC721("PixelNFT", "PXNFT") Ownable(msg.sender) {}

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
        address owner = ownerOf(tokenId);
        require(
            owner == msg.sender || 
            getApproved(tokenId) == msg.sender ||
            isApprovedForAll(owner, msg.sender), 
            "Not authorized to update this pixel"
        );
        
        // Validate and normalize color
        string memory validColor = _validateAndNormalizeColor(color);
        pixelColors[tokenId] = validColor;
        
        emit ColorUpdated(tokenId, x, y, validColor, owner);
    }
    
    function batchUpdateColor(uint256[] memory x, uint256[] memory y, string[] memory colors) external {
        require(x.length == y.length && y.length == colors.length, "Arrays length mismatch");
        require(x.length > 0, "Empty arrays");
        
        for (uint256 i = 0; i < x.length; i++) {
            uint256 tokenId = _getTokenId(x[i], y[i]);
            address owner = ownerOf(tokenId);
            require(
                owner == msg.sender || 
                getApproved(tokenId) == msg.sender ||
                isApprovedForAll(owner, msg.sender), 
                "Not authorized to update pixel"
            );
            
            // Validate and normalize color
            string memory validColor = _validateAndNormalizeColor(colors[i]);
            pixelColors[tokenId] = validColor;
            
            emit ColorUpdated(tokenId, x[i], y[i], validColor, owner);
        }
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

    // Delegation Functions
    
    /**
     * @dev Approve multiple pixels at once for delegation
     * @param x Array of X coordinates
     * @param y Array of Y coordinates  
     * @param to Address to approve for all pixels
     */
    function batchApprove(uint256[] memory x, uint256[] memory y, address to) external {
        require(x.length == y.length, "Arrays length mismatch");
        require(x.length > 0, "Empty arrays");
        require(to != address(0), "Cannot approve zero address");
        
        for (uint256 i = 0; i < x.length; i++) {
            uint256 tokenId = _getTokenId(x[i], y[i]);
            require(ownerOf(tokenId) == msg.sender, "Not the owner of pixel");
            
            // Use the inherited approve function
            approve(to, tokenId);
        }
    }
    
    /**
     * @dev Approve a single pixel by coordinates for delegation
     * @param x X coordinate
     * @param y Y coordinate
     * @param to Address to approve
     */
    function approvePixel(uint256 x, uint256 y, address to) external {
        uint256 tokenId = _getTokenId(x, y);
        require(ownerOf(tokenId) == msg.sender, "Not the owner of pixel");
        
        approve(to, tokenId);
    }
    
    /**
     * @dev Approve multiple pixels to multiple addresses in a single transaction
     * @param x Array of X coordinates
     * @param y Array of Y coordinates  
     * @param operators Array of addresses to approve for all pixels
     */
    function batchApproveMultipleAddresses(uint256[] memory x, uint256[] memory y, address[] memory operators) external {
        require(x.length == y.length, "Coordinates arrays length mismatch");
        require(x.length > 0, "Empty coordinates arrays");
        require(operators.length > 0, "Empty operators array");
        
        // Approve each pixel to each operator
        for (uint256 i = 0; i < x.length; i++) {
            uint256 tokenId = _getTokenId(x[i], y[i]);
            require(ownerOf(tokenId) == msg.sender, "Not the owner of pixel");
            
            for (uint256 j = 0; j < operators.length; j++) {
                require(operators[j] != address(0), "Cannot approve zero address");
                // Use the inherited approve function for each operator
                approve(operators[j], tokenId);
            }
        }
    }

    /**
     * @dev Check if an address is authorized to update a pixel
     * @param x X coordinate
     * @param y Y coordinate
     * @param operator Address to check authorization for
     * @return True if authorized to update the pixel
     */
    function isPixelAuthorized(uint256 x, uint256 y, address operator) external view returns (bool) {
        uint256 tokenId = _getTokenId(x, y);
        if (!_exists(tokenId)) return false;
        
        address owner = ownerOf(tokenId);
        return owner == operator || 
               getApproved(tokenId) == operator ||
               isApprovedForAll(owner, operator);
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function generateCollectionAvatar() public view returns (string memory) {
        // Create a more compact SVG for gas efficiency
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 ', 
            Strings.toString(WIDTH), ' ', Strings.toString(HEIGHT), 
            '" style="image-rendering: pixelated;">'
        ));
        
        // Add background
        svg = string(abi.encodePacked(
            svg,
            '<rect width="100%" height="100%" fill="', DEFAULT_COLOR, '"/>'
        ));
        
        // Add each minted pixel as a 1x1 rectangle
        for (uint256 y = 0; y < HEIGHT; y++) {
            for (uint256 x = 0; x < WIDTH; x++) {
                uint256 tokenId = _getTokenId(x, y);
                if (_exists(tokenId)) {
                    string memory color = pixelColors[tokenId];
                    if (bytes(color).length == 0) {
                        color = DEFAULT_COLOR;
                    }
                    
                    svg = string(abi.encodePacked(
                        svg,
                        '<rect x="', Strings.toString(x), 
                        '" y="', Strings.toString(y), 
                        '" width="1" height="1" fill="', color, '"/>'
                    ));
                }
            }
        }
        
        svg = string(abi.encodePacked(svg, '</svg>'));
        return svg;
    }

    //KEY FUNCTION - contractURI() for marketplace recognition
    function contractURI() public view returns (string memory) {
        string memory svg = generateCollectionAvatar();
        
        // Calculate completion percentage
        uint256 completionPercentage = (_totalMinted * 100) / (WIDTH * HEIGHT);
        
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{',
                            '"name": "Pixel Canvas Collection",',
                            '"description": "', collectionDescription, '",',
                            '"image": "data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
                            '"external_link": "', externalUrl, '",',
                            '"seller_fee_basis_points": 250,',
                            '"fee_recipient": "', Strings.toHexString(uint160(owner()), 20), '",',
                            '"attributes": [',
                                '{"trait_type": "Total Pixels", "value": ', Strings.toString(WIDTH * HEIGHT), '},',
                                '{"trait_type": "Minted Pixels", "value": ', Strings.toString(_totalMinted), '},',
                                '{"trait_type": "Available Pixels", "value": ', Strings.toString(WIDTH * HEIGHT - _totalMinted), '},',
                                '{"trait_type": "Completion", "value": "', Strings.toString(completionPercentage), '%"},',
                                '{"trait_type": "Canvas Size", "value": "', Strings.toString(WIDTH), 'x', Strings.toString(HEIGHT), '"}',
                            ']',
                        '}'
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    // Owner functions to update collection info
    function setCollectionDescription(string memory _description) external onlyOwner {
        collectionDescription = _description;
    }
    
    function setExternalUrl(string memory _url) external onlyOwner {
        externalUrl = _url;
    }

    // Generate regional avatar for gas efficiency
    function generateRegionAvatar(uint256 startX, uint256 startY, uint256 endX, uint256 endY, uint256 scale) 
        public view returns (string memory) {
        require(startX <= endX && startY <= endY, "Invalid range");
        require(endX < WIDTH && endY < HEIGHT, "Range out of bounds");
        require(scale > 0 && scale <= 10, "Invalid scale");
        
        uint256 regionWidth = endX - startX + 1;
        uint256 regionHeight = endY - startY + 1;
        uint256 svgWidth = regionWidth * scale;
        uint256 svgHeight = regionHeight * scale;
        
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="', Strings.toString(svgWidth), 
            '" height="', Strings.toString(svgHeight), '" style="image-rendering: pixelated;">'
        ));
        
        // Add background
        svg = string(abi.encodePacked(
            svg,
            '<rect width="100%" height="100%" fill="', DEFAULT_COLOR, '"/>'
        ));
        
        // Add each minted pixel in the region
        for (uint256 y = startY; y <= endY; y++) {
            for (uint256 x = startX; x <= endX; x++) {
                uint256 tokenId = _getTokenId(x, y);
                if (_exists(tokenId)) {
                    string memory color = pixelColors[tokenId];
                    if (bytes(color).length == 0) {
                        color = DEFAULT_COLOR;
                    }
                    
                    uint256 rectX = (x - startX) * scale;
                    uint256 rectY = (y - startY) * scale;
                    
                    svg = string(abi.encodePacked(
                        svg,
                        '<rect x="', Strings.toString(rectX), 
                        '" y="', Strings.toString(rectY), 
                        '" width="', Strings.toString(scale), 
                        '" height="', Strings.toString(scale), 
                        '" fill="', color, '"/>'
                    ));
                }
            }
        }
        
        svg = string(abi.encodePacked(svg, '</svg>'));
        return svg;
    }


    
    function totalMinted() external view returns (uint256) {
        return _totalMinted;
    }

    // Support for EIP-165 (Standard Interface Detection)
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == bytes4(0x49064906) || // ERC-4906 (Metadata Update)
               super.supportsInterface(interfaceId);
    }

    // Emit metadata update events when pixels are minted/updated
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

    // Function to manually trigger collection metadata refresh on marketplaces
    function refreshCollectionMetadata() external {
        emit BatchMetadataUpdate(0, WIDTH * HEIGHT - 1);
    }

    // Composition System
    mapping(uint256 => bool) public isComposedPixel; // Track if a pixel is part of a composition
    mapping(uint256 => uint256) public compositeTokens; // Map composite ID to area
    mapping(uint256 => uint256[]) public compositeComponents; // Map composite ID to component token IDs
    uint256 private _compositeIdCounter = 100000; // Start composite IDs at 100000 to avoid conflicts
    
    event PixelsComposed(uint256 indexed compositeId, uint256[] tokenIds, address owner);
    event CompositionDecomposed(uint256 indexed compositeId, uint256[] tokenIds, address owner);

    /**
     * @dev Get owned pixels in an area for potential composition
     * @param startX Top-left X coordinate of the area
     * @param startY Top-left Y coordinate of the area  
     * @param endX Bottom-right X coordinate of the area
     * @param endY Bottom-right Y coordinate of the area
     * @param owner Address to check ownership for
     * @return tokenIds Array of token IDs owned by the address in the area
     */
    function getOwnedPixelsInArea(uint256 startX, uint256 startY, uint256 endX, uint256 endY, address owner) 
        external view returns (uint256[] memory tokenIds) {
        
        require(startX <= endX && startY <= endY, "Invalid area coordinates");
        require(endX < WIDTH && endY < HEIGHT, "Area out of bounds");
        
        uint256 areaSize = (endX - startX + 1) * (endY - startY + 1);
        uint256[] memory tempTokenIds = new uint256[](areaSize);
        uint256 count = 0;
        
        // Find all pixels owned by the user in the area
        for (uint256 y = startY; y <= endY; y++) {
            for (uint256 x = startX; x <= endX; x++) {
                uint256 tokenId = _getTokenId(x, y);
                
                if (_exists(tokenId) && ownerOf(tokenId) == owner && !isComposedPixel[tokenId]) {
                    tempTokenIds[count] = tokenId;
                    count++;
                }
            }
        }
        
        // Create properly sized array
        tokenIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            tokenIds[i] = tempTokenIds[i];
        }
        
        return tokenIds;
    }

    /**
     * @dev Compose multiple pixels into a single composite NFT (filters to owned pixels only)
     * @param startX Top-left X coordinate of the area
     * @param startY Top-left Y coordinate of the area  
     * @param endX Bottom-right X coordinate of the area
     * @param endY Bottom-right Y coordinate of the area
     */
    function composePixels(uint256 startX, uint256 startY, uint256 endX, uint256 endY) external {
        require(startX <= endX && startY <= endY, "Invalid area coordinates");
        require(endX < WIDTH && endY < HEIGHT, "Area out of bounds");
        
        // Get only the pixels owned by the caller in the area
        uint256[] memory tokenIds = this.getOwnedPixelsInArea(startX, startY, endX, endY, msg.sender);
        
        require(tokenIds.length >= 2, "Need at least 2 owned pixels to compose");
        
        // Create composite NFT
        uint256 compositeId = _compositeIdCounter++;
        _mint(msg.sender, compositeId);
        
        // Mark pixels as composed and store composition data
        for (uint256 i = 0; i < tokenIds.length; i++) {
            isComposedPixel[tokenIds[i]] = true;
        }
        
        compositeComponents[compositeId] = tokenIds;
        
        emit PixelsComposed(compositeId, tokenIds, msg.sender);
    }
    
    /**
     * @dev Decompose a composite NFT back into individual pixels
     * @param compositeId The ID of the composite NFT to decompose
     */
    function decomposePixels(uint256 compositeId) external {
        require(ownerOf(compositeId) == msg.sender, "Not owner of composite");
        require(compositeComponents[compositeId].length > 0, "Not a composite NFT");
        
        uint256[] memory tokenIds = compositeComponents[compositeId];
        
        // Burn the composite NFT
        _burn(compositeId);
        
        // Unmark pixels as composed
        for (uint256 i = 0; i < tokenIds.length; i++) {
            isComposedPixel[tokenIds[i]] = false;
        }
        
        // Clear composition data
        delete compositeComponents[compositeId];
        
        emit CompositionDecomposed(compositeId, tokenIds, msg.sender);
    }
    
    /**
     * @dev Check if an area can be composed by the given address (checks owned pixels only)
     * @param startX Top-left X coordinate
     * @param startY Top-left Y coordinate
     * @param endX Bottom-right X coordinate
     * @param endY Bottom-right Y coordinate
     * @param owner Address to check ownership for
     * @return canCompose Whether the area can be composed
     * @return reason Reason if it can't be composed
     * @return ownedCount Number of pixels owned by the user in the area
     */
    function canComposeArea(uint256 startX, uint256 startY, uint256 endX, uint256 endY, address owner) 
        external view returns (bool canCompose, string memory reason, uint256 ownedCount) {
        
        if (startX > endX || startY > endY) {
            return (false, "Invalid coordinates", 0);
        }
        
        if (endX >= WIDTH || endY >= HEIGHT) {
            return (false, "Area out of bounds", 0);
        }
        
        // Get owned pixels in the area
        uint256[] memory ownedPixels = this.getOwnedPixelsInArea(startX, startY, endX, endY, owner);
        ownedCount = ownedPixels.length;
        
        if (ownedCount < 2) {
            return (false, "Need at least 2 owned pixels", ownedCount);
        }
        
        return (true, "", ownedCount);
    }
    
    /**
     * @dev Get composition info for a composite NFT
     */
    function getCompositionInfo(uint256 compositeId) external view returns (uint256[] memory tokenIds, uint256 minX, uint256 minY, uint256 maxX, uint256 maxY) {
        tokenIds = compositeComponents[compositeId];
        require(tokenIds.length > 0, "Not a composite NFT");
        
        minX = WIDTH;
        minY = HEIGHT;
        maxX = 0;
        maxY = 0;
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 x = tokenIds[i] % WIDTH;
            uint256 y = tokenIds[i] / WIDTH;
            
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }
    
    /**
     * @dev Generate metadata for composite NFTs
     */
    function generateCompositeTokenURI(uint256 compositeId) internal view returns (string memory) {
        uint256[] memory tokenIds = compositeComponents[compositeId];
        require(tokenIds.length > 0, "Not a composite NFT");
        
        (, uint256 minX, uint256 minY, uint256 maxX, uint256 maxY) = this.getCompositionInfo(compositeId);
        
        uint256 width = maxX - minX + 1;
        uint256 height = maxY - minY + 1;
        
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="', Strings.toString(width * 10), 
            '" height="', Strings.toString(height * 10), '" style="image-rendering: pixelated;">'
        ));
        
        // Add each pixel in the composition
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 x = tokenIds[i] % WIDTH;
            uint256 y = tokenIds[i] / WIDTH;
            string memory color = pixelColors[tokenIds[i]];
            
            svg = string(abi.encodePacked(
                svg,
                '<rect x="', Strings.toString((x - minX) * 10), 
                '" y="', Strings.toString((y - minY) * 10), 
                '" width="10" height="10" fill="', color, '"/>'
            ));
        }
        
        svg = string(abi.encodePacked(svg, '</svg>'));
        
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{',
                            '"name": "Composite Pixel Art (', Strings.toString(width), 'x', Strings.toString(height), ')",',
                            '"description": "A composite NFT made from ', Strings.toString(tokenIds.length), ' individual pixels.",',
                            '"image": "data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
                            '"attributes": [',
                                '{"trait_type": "Width", "value": ', Strings.toString(width), '},',
                                '{"trait_type": "Height", "value": ', Strings.toString(height), '},',
                                '{"trait_type": "Pixel Count", "value": ', Strings.toString(tokenIds.length), '},',
                                '{"trait_type": "Start X", "value": ', Strings.toString(minX), '},',
                                '{"trait_type": "Start Y", "value": ', Strings.toString(minY), '}',
                            ']',
                        '}'
                    )
                )
            )
        );
        
        return string(abi.encodePacked("data:application/json;base64,", json));
    }
    
    /**
     * @dev Override tokenURI to handle composite NFTs
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Nonexistent token");
        
        // Check if it's a composite NFT
        if (tokenId >= 100000 && compositeComponents[tokenId].length > 0) {
            return generateCompositeTokenURI(tokenId);
        }
        
        // Regular pixel NFT
        string memory color = pixelColors[tokenId];
        if (bytes(color).length == 0) {
            color = DEFAULT_COLOR;
        }
        
        string memory x = Strings.toString(tokenId % WIDTH);
        string memory y = Strings.toString(tokenId / WIDTH);

        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" ',
            'viewBox="0 0 100 100" ',
            'preserveAspectRatio="xMidYMid meet">',
            '<rect x="0" y="0" width="100" height="100" fill="', color, '" />',
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
                                '{"trait_type": "X", "value": ', x, '},',  // Missing!
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
}