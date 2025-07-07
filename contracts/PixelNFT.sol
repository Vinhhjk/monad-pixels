// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PixelNFT is ERC721, Ownable {
    uint256 public constant WIDTH = 150;
    uint256 public constant HEIGHT = 150;
    mapping(uint256 => string) public pixelColors;
    uint256 private _totalMinted = 0;
    
    // Fee system constants and variables
    uint256 public updateFee = 0.1 ether;
    uint256 public platformFeePercentage = 10; // 10% platform fee
    address[] public exemptionContracts;
    
    // Custom multi-approval system - allows multiple addresses per pixel
    mapping(uint256 => mapping(address => bool)) private _customApprovals;
    
    // Track count of approved addresses per pixel for easy querying
    mapping(uint256 => uint256) public pixelApprovalCounts;
    
    // Store array of approved addresses per pixel for enumeration
    mapping(uint256 => address[]) private _pixelApprovedAddressList;
    
    // Add default color constant
    string public constant DEFAULT_COLOR = "#ffffff";
    
    // Collection info
    string public collectionDescription = "A collaborative pixel art canvas where each pixel is an NFT. Create art together on-chain!";
    string public externalUrl = "https://pixels.monadfrens.fun";

    // Add custom event for color updates
    event ColorUpdated(uint256 indexed tokenId, uint256 indexed x, uint256 indexed y, string color, address owner);
    
    // Fee system events
    event PixelUpdateFeePaid(uint256 indexed tokenId, address indexed updater, address indexed pixelOwner, uint256 x, uint256 y, uint256 amount);
    event PlatformFeePaid(uint256 indexed tokenId, address indexed updater, uint256 platformFee, uint256 ownerFee);
    event ExemptionContractAdded(address indexed contractAddress);
    event ExemptionContractRemoved(address indexed contractAddress);
    event UpdateFeeChanged(uint256 oldFee, uint256 newFee);
    event PlatformFeePercentageChanged(uint256 oldPercentage, uint256 newPercentage);

    constructor() ERC721("PixelNFT", "PXNFT") Ownable(msg.sender) {
        // Initialize with default exemption contracts
        exemptionContracts.push(0xF3ad8B549D57004e628D875d452B961aFfE8A611);
        exemptionContracts.push(0xE6B5427b174344fd5CB1e3d5550306B0055473C6);
        exemptionContracts.push(0x7370A0a9E9A833Bcd071b38FC25184E7AFB57AFF);
    }
    
    /**
     * @dev Check if an address holds at least 1 NFT from any exemption contracts
     * @param account Address to check
     * @return true if account holds NFTs from any exemption contract
     */
    function hasExemption(address account) public view returns (bool) {
        for (uint256 i = 0; i < exemptionContracts.length; i++) {
            try IERC721(exemptionContracts[i]).balanceOf(account) returns (uint256 balance) {
                if (balance > 0) return true;
            } catch {
                // If contract doesn't exist or call fails, continue checking
            }
        }
        return false;
    }
    
    /**
     * @dev Get all exemption contract addresses
     * @return Array of exemption contract addresses
     */
    function getExemptionContracts() external view returns (address[] memory) {
        return exemptionContracts;
    }
    
    /**
     * @dev Add an exemption contract (only owner)
     * @param contractAddress Address of the contract to add
     */
    function addExemptionContract(address contractAddress) external onlyOwner {
        require(contractAddress != address(0), "Invalid contract address");
        
        // Check if contract already exists
        for (uint256 i = 0; i < exemptionContracts.length; i++) {
            require(exemptionContracts[i] != contractAddress, "Contract already exists");
        }
        
        exemptionContracts.push(contractAddress);
        emit ExemptionContractAdded(contractAddress);
    }
    
    /**
     * @dev Remove an exemption contract (only owner)
     * @param contractAddress Address of the contract to remove
     */
    function removeExemptionContract(address contractAddress) external onlyOwner {
        require(contractAddress != address(0), "Invalid contract address");
        
        for (uint256 i = 0; i < exemptionContracts.length; i++) {
            if (exemptionContracts[i] == contractAddress) {
                // Move the last element to this position and pop
                exemptionContracts[i] = exemptionContracts[exemptionContracts.length - 1];
                exemptionContracts.pop();
                emit ExemptionContractRemoved(contractAddress);
                return;
            }
        }
        
        revert("Contract not found");
    }
    
    /**
     * @dev Set the update fee (only owner)
     * @param newFee New fee amount in wei
     */
    function setUpdateFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = updateFee;
        updateFee = newFee;
        emit UpdateFeeChanged(oldFee, newFee);
    }
    
    /**
     * @dev Set the platform fee percentage (only owner)
     * @param newPercentage New percentage (0-100)
     */
    function setPlatformFeePercentage(uint256 newPercentage) external onlyOwner {
        require(newPercentage <= 100, "Percentage cannot exceed 100");
        uint256 oldPercentage = platformFeePercentage;
        platformFeePercentage = newPercentage;
        emit PlatformFeePercentageChanged(oldPercentage, newPercentage);
    }

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
    
    function updateColor(uint256 x, uint256 y, string memory color) external payable {
        uint256 tokenId = _getTokenId(x, y);
        address pixelOwner = ownerOf(tokenId);
        bool isAuthorized = (
            pixelOwner == msg.sender || 
            _customApprovals[tokenId][msg.sender]  // Only use custom approvals
        );
        
        // If not authorized, check fee requirements
        if (!isAuthorized) {
            bool hasNFTExemption = hasExemption(msg.sender);
            
            if (!hasNFTExemption) {
                // Require fee payment
                require(msg.value >= updateFee, "Insufficient fee for pixel update");
                
                // Calculate platform fee and owner fee
                uint256 platformFee = (updateFee * platformFeePercentage) / 100;
                uint256 ownerFee = updateFee - platformFee;
                
                // Pay platform fee to contract owner (only if > 0)
                if (platformFee > 0) {
                    (bool platformSuccess, ) = payable(owner()).call{value: platformFee}("");
                    require(platformSuccess, "Platform fee transfer failed");
                }
                
                // Pay remaining fee to pixel owner (only if > 0)
                if (ownerFee > 0) {
                    (bool ownerSuccess, ) = payable(pixelOwner).call{value: ownerFee}("");
                    require(ownerSuccess, "Owner fee transfer failed");
                }
                
                // Emit fee payment events
                emit PixelUpdateFeePaid(tokenId, msg.sender, pixelOwner, x, y, updateFee);
                emit PlatformFeePaid(tokenId, msg.sender, platformFee, ownerFee);
                
                // Refund excess payment
                if (msg.value > updateFee) {
                    (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - updateFee}("");
                    require(refundSuccess, "Refund failed");
                }
            } else {
                // NFT holder exemption - no fee required, but refund any sent ETH
                if (msg.value > 0) {
                    (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value}("");
                    require(refundSuccess, "Refund failed");
                }
            }
        } else {
            // Authorized user - refund any sent ETH
            if (msg.value > 0) {
                (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value}("");
                require(refundSuccess, "Refund failed");
            }
        }
        
        // Validate and normalize color
        string memory validColor = _validateAndNormalizeColor(color);
        pixelColors[tokenId] = validColor;
        
        emit ColorUpdated(tokenId, x, y, validColor, pixelOwner);
    }
    
    function batchUpdateColor(uint256[] memory x, uint256[] memory y, string[] memory colors) external payable {
        require(x.length == y.length && y.length == colors.length, "Arrays length mismatch");
        require(x.length > 0, "Empty arrays");
        
        bool hasNFTExemption = hasExemption(msg.sender);
        uint256 totalFeesRequired = 0;
        uint256 unauthorizedCount = 0;
        
        // First pass: check authorization and calculate fees
        for (uint256 i = 0; i < x.length; i++) {
            uint256 tokenId = _getTokenId(x[i], y[i]);
            address pixelOwner = ownerOf(tokenId);
            bool isAuthorized = (
                pixelOwner == msg.sender || 
                _customApprovals[tokenId][msg.sender]  // Only use custom approvals
            );
            
            if (!isAuthorized && !hasNFTExemption) {
                totalFeesRequired += updateFee;
                unauthorizedCount++;
            }
        }
        
        // Check if enough ETH was sent for unauthorized pixels
        if (totalFeesRequired > 0) {
            require(msg.value >= totalFeesRequired, "Insufficient fee for batch pixel update");
        }
        
        uint256 feesDistributed = 0;
        
        // Second pass: update colors and distribute fees
        for (uint256 i = 0; i < x.length; i++) {
            uint256 tokenId = _getTokenId(x[i], y[i]);
            address pixelOwner = ownerOf(tokenId);
            bool isAuthorized = (
                pixelOwner == msg.sender || 
                _customApprovals[tokenId][msg.sender]  // Only use custom approvals
            );
            
            // Handle fee payment for unauthorized pixels
            if (!isAuthorized && !hasNFTExemption) {
                // Calculate platform fee and owner fee
                uint256 platformFee = (updateFee * platformFeePercentage) / 100;
                uint256 ownerFee = updateFee - platformFee;
                
                // Pay platform fee to contract owner (only if > 0)
                if (platformFee > 0) {
                    (bool platformSuccess, ) = payable(owner()).call{value: platformFee}("");
                    require(platformSuccess, "Platform fee transfer failed");
                }
                
                // Pay remaining fee to pixel owner (only if > 0)
                if (ownerFee > 0) {
                    (bool ownerSuccess, ) = payable(pixelOwner).call{value: ownerFee}("");
                    require(ownerSuccess, "Owner fee transfer failed");
                }
                
                feesDistributed += updateFee;
                
                // Emit fee payment events
                emit PixelUpdateFeePaid(tokenId, msg.sender, pixelOwner, x[i], y[i], updateFee);
                emit PlatformFeePaid(tokenId, msg.sender, platformFee, ownerFee);
            }
            
            // Validate and normalize color
            string memory validColor = _validateAndNormalizeColor(colors[i]);
            pixelColors[tokenId] = validColor;
            
            emit ColorUpdated(tokenId, x[i], y[i], validColor, pixelOwner);
        }
        
        // Refund excess payment
        if (msg.value > feesDistributed) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - feesDistributed}("");
            require(refundSuccess, "Refund failed");
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

    // Custom Multi-Approval System (replaces standard delegation)

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
               _customApprovals[tokenId][operator]; // Only use custom approvals
    }

    // Custom Multi-Approval System
    
    /**
     * @dev Approve an address for a specific pixel (allows multiple approvals per pixel)
     * @param x X coordinate
     * @param y Y coordinate
     * @param operator Address to approve
     */
    function approvePixelMulti(uint256 x, uint256 y, address operator) external {
        uint256 tokenId = _getTokenId(x, y);
        require(ownerOf(tokenId) == msg.sender, "Not the owner of pixel");
        require(operator != address(0), "Cannot approve zero address");
        require(operator != msg.sender, "Cannot approve yourself");
        
        // Only increment if this is a new approval
        if (!_customApprovals[tokenId][operator]) {
            _customApprovals[tokenId][operator] = true;
            pixelApprovalCounts[tokenId]++;
            _pixelApprovedAddressList[tokenId].push(operator);
        }
    }
    
    /**
     * @dev Revoke approval for an address for a specific pixel
     * @param x X coordinate
     * @param y Y coordinate
     * @param operator Address to revoke approval from
     */
    function revokePixelMulti(uint256 x, uint256 y, address operator) external {
        uint256 tokenId = _getTokenId(x, y);
        require(ownerOf(tokenId) == msg.sender, "Not the owner of pixel");
        
        // Only decrement if this was actually approved
        if (_customApprovals[tokenId][operator]) {
            _customApprovals[tokenId][operator] = false;
            pixelApprovalCounts[tokenId]--;
            _removeFromApprovedList(tokenId, operator);
        }
    }
    
    /**
     * @dev Check if an address has custom approval for a specific pixel
     * @param x X coordinate
     * @param y Y coordinate
     * @param operator Address to check
     * @return True if operator has custom approval for this pixel
     */
    function hasPixelMultiApproval(uint256 x, uint256 y, address operator) external view returns (bool) {
        uint256 tokenId = _getTokenId(x, y);
        return _customApprovals[tokenId][operator];
    }
    
    /**
     * @dev Batch approve multiple addresses for multiple pixels
     * @param x Array of X coordinates
     * @param y Array of Y coordinates
     * @param operators Array of addresses to approve for ALL specified pixels
     */
    function batchApprovePixelMulti(uint256[] memory x, uint256[] memory y, address[] memory operators) external {
        require(x.length == y.length, "Coordinates arrays length mismatch");
        require(x.length > 0, "Empty coordinates arrays");
        require(operators.length > 0, "Empty operators array");
        
        // Approve each operator for each pixel
        for (uint256 i = 0; i < x.length; i++) {
            uint256 tokenId = _getTokenId(x[i], y[i]);
            require(ownerOf(tokenId) == msg.sender, "Not the owner of pixel");
            
            for (uint256 j = 0; j < operators.length; j++) {
                require(operators[j] != address(0), "Cannot approve zero address");
                require(operators[j] != msg.sender, "Cannot approve yourself");
                
                // Only increment if this is a new approval
                if (!_customApprovals[tokenId][operators[j]]) {
                    _customApprovals[tokenId][operators[j]] = true;
                    pixelApprovalCounts[tokenId]++;
                    _pixelApprovedAddressList[tokenId].push(operators[j]);
                }
            }
        }
    }
    
    /**
     * @dev Batch revoke multiple addresses for multiple pixels
     * @param x Array of X coordinates
     * @param y Array of Y coordinates
     * @param operators Array of addresses to revoke from ALL specified pixels
     */
    function batchRevokePixelMulti(uint256[] memory x, uint256[] memory y, address[] memory operators) external {
        require(x.length == y.length, "Coordinates arrays length mismatch");
        require(x.length > 0, "Empty coordinates arrays");
        require(operators.length > 0, "Empty operators array");
        
        // Revoke each operator from each pixel
        for (uint256 i = 0; i < x.length; i++) {
            uint256 tokenId = _getTokenId(x[i], y[i]);
            require(ownerOf(tokenId) == msg.sender, "Not the owner of pixel");
            
            for (uint256 j = 0; j < operators.length; j++) {
                // Only decrement if this was actually approved
                if (_customApprovals[tokenId][operators[j]]) {
                    _customApprovals[tokenId][operators[j]] = false;
                    pixelApprovalCounts[tokenId]--;
                    _removeFromApprovedList(tokenId, operators[j]);
                }
            }
        }
    }

    // Helper function to remove an address from the approved list
    function _removeFromApprovedList(uint256 tokenId, address operator) private {
        address[] storage approvedList = _pixelApprovedAddressList[tokenId];
        for (uint256 i = 0; i < approvedList.length; i++) {
            if (approvedList[i] == operator) {
                // Move the last element to this position and pop
                approvedList[i] = approvedList[approvedList.length - 1];
                approvedList.pop();
                break;
            }
        }
    }

    // View functions for the custom multi-approval system
    
    /**
     * @dev Get the count of approved addresses for a specific pixel
     * @param x X coordinate
     * @param y Y coordinate
     * @return count Number of addresses that have approval for this pixel
     */
    function getPixelApprovalCount(uint256 x, uint256 y) external view returns (uint256 count) {
        uint256 tokenId = _getTokenId(x, y);
        require(_exists(tokenId), "Pixel does not exist");
        return pixelApprovalCounts[tokenId];
    }
    
    /**
     * @dev Get all approved addresses for a specific pixel
     * @param x X coordinate
     * @param y Y coordinate
     * @return addresses Array of all approved addresses for this pixel
     */
    function getPixelApprovedAddressesList(uint256 x, uint256 y) external view returns (address[] memory addresses) {
        uint256 tokenId = _getTokenId(x, y);
        require(_exists(tokenId), "Pixel does not exist");
        return _pixelApprovedAddressList[tokenId];
    }
    
    /**
     * @dev Get all approved addresses for a specific pixel (requires list of addresses to check)
     * @param x X coordinate
     * @param y Y coordinate
     * @param addresses Array of addresses to check
     * @return approvedAddresses Array of addresses that have approval
     */
    function getPixelApprovedAddresses(uint256 x, uint256 y, address[] memory addresses) external view returns (address[] memory approvedAddresses) {
        uint256 tokenId = _getTokenId(x, y);
        require(_exists(tokenId), "Pixel does not exist");
        
        uint256 count = 0;
        address[] memory temp = new address[](addresses.length);
        
        for (uint256 i = 0; i < addresses.length; i++) {
            if (_customApprovals[tokenId][addresses[i]]) {
                temp[count] = addresses[i];
                count++;
            }
        }
        
        approvedAddresses = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            approvedAddresses[i] = temp[i];
        }
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function generateCollectionAvatar() public view returns (string memory) {
        // Calculate center area (20x21 = 420 pixels)
        uint256 centerX = WIDTH / 2;  // 150/2 = 75
        uint256 centerY = HEIGHT / 2; // 150/2 = 75
        uint256 halfWidth = 10;   // 20 pixels wide (10 each side)
        uint256 halfHeight = 10;  // 21 pixels tall (10 + center + 10)
        
        uint256 startX = centerX > halfWidth ? centerX - halfWidth : 0;      // 75-10 = 65
        uint256 endX = centerX + halfWidth < WIDTH ? centerX + halfWidth : WIDTH - 1;  // 75+10 = 85
        uint256 startY = centerY > halfHeight ? centerY - halfHeight : 0;    // 75-10 = 65  
        uint256 endY = centerY + halfHeight < HEIGHT ? centerY + halfHeight : HEIGHT - 1; // 75+10 = 85
            
        uint256 regionWidth = endX - startX + 1;
        uint256 regionHeight = endY - startY + 1;
        
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 ', 
            Strings.toString(regionWidth), ' ', Strings.toString(regionHeight), 
            '" style="image-rendering: pixelated;">'
        ));
        
        // Add background
        svg = string(abi.encodePacked(
            svg,
            '<rect width="100%" height="100%" fill="', DEFAULT_COLOR, '"/>'
        ));
        
        // Add only center pixels
        for (uint256 y = startY; y <= endY; y++) {
            for (uint256 x = startX; x <= endX; x++) {
                uint256 tokenId = _getTokenId(x, y);
                if (_exists(tokenId)) {
                    string memory color = pixelColors[tokenId];
                    if (bytes(color).length == 0) {
                        color = DEFAULT_COLOR;
                    }
                    
                    svg = string(abi.encodePacked(
                        svg,
                        '<rect x="', Strings.toString(x - startX), 
                        '" y="', Strings.toString(y - startY), 
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
                            '"name": "Onchain Pixels Collection",',
                            '"description": "', collectionDescription, '",',
                            '"image": "data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
                            '"external_link": "', externalUrl, '",',
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

    // Owner functions to manually update collection info
    function setCollectionDescription(string memory _description) external onlyOwner {
        collectionDescription = _description;
    }
    
    function setExternalUrl(string memory _url) external onlyOwner {
        externalUrl = _url;
    }
    
    /**
     * @dev Calculate fee required for batch update of specific pixels
     * @param x Array of X coordinates
     * @param y Array of Y coordinates
     * @param account Address that wants to update the pixels
     * @return totalFee Total fee required in wei
     * @return unauthorizedCount Number of pixels requiring fee payment
     */
    function calculateBatchUpdateFee(uint256[] memory x, uint256[] memory y, address account) 
        external view returns (uint256 totalFee, uint256 unauthorizedCount) {
        require(x.length == y.length, "Arrays length mismatch");
        
        bool hasNFTExemption = hasExemption(account);
        if (hasNFTExemption) {
            return (0, 0);
        }
        
        for (uint256 i = 0; i < x.length; i++) {
            uint256 tokenId = _getTokenId(x[i], y[i]);
            if (!_exists(tokenId)) continue; // Skip unminted pixels
            
            address pixelOwner = ownerOf(tokenId);
            bool isAuthorized = (
                pixelOwner == account || 
                _customApprovals[tokenId][account]  // Only use custom approvals
            );
            
            if (!isAuthorized) {
                totalFee += updateFee;
                unauthorizedCount++;
            }
        }
    }
    
    /**
     * @dev Calculate fee required for single pixel update
     * @param x X coordinate
     * @param y Y coordinate
     * @param account Address that wants to update the pixel
     * @return fee Fee required in wei (0 if authorized or exempt)
     * @return requiresFee Whether fee payment is required
     */
    function calculateUpdateFee(uint256 x, uint256 y, address account) 
        external view returns (uint256 fee, bool requiresFee) {
        uint256 tokenId = _getTokenId(x, y);
        if (!_exists(tokenId)) {
            return (0, false); // Unminted pixels don't require fees
        }
        
        address pixelOwner = ownerOf(tokenId);
        bool isAuthorized = (
            pixelOwner == account || 
            _customApprovals[tokenId][account]  // Only use custom approvals
        );
        
        if (isAuthorized) {
            return (0, false);
        }
        
        bool hasNFTExemption = hasExemption(account);
        if (hasNFTExemption) {
            return (0, false);
        }
        
        return (updateFee, true);
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
            '<svg xmlns="http://www.w3.org/2000/svg" ',
            'viewBox="0 0 ', Strings.toString(width * 10), ' ', Strings.toString(height * 10), '" ',
            'preserveAspectRatio="xMidYMid meet" style="image-rendering: pixelated;">'
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
    // Add this function to your contract (around line 800, after the other view functions)

    /**
    * @dev Get SVG images for a batch of token IDs (gas efficient)
    * @param tokenIds Array of token IDs to get images for
    * @return images Array of base64 encoded SVG images
    * @return exists Array indicating which tokens exist
    */
    function getBatchTokenImages(uint256[] memory tokenIds) 
        external view returns (string[] memory images, bool[] memory exists) {
        
        require(tokenIds.length <= 20, "Batch size too large"); // Limit to prevent gas issues
        
        images = new string[](tokenIds.length);
        exists = new bool[](tokenIds.length);
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            
            if (_exists(tokenId)) {
                exists[i] = true;
                
                // Check if it's a composite NFT
                if (tokenId >= 100000 && compositeComponents[tokenId].length > 0) {
                    // Generate composite image
                    images[i] = _generateCompositeImage(tokenId);
                } else {
                    // Generate regular pixel image
                    images[i] = _generatePixelImage(tokenId);
                }
            } else {
                exists[i] = false;
                images[i] = "";
            }
        }
        
        return (images, exists);
    }

    /**
    * @dev Generate base64 encoded SVG for a single pixel
    */
    function _generatePixelImage(uint256 tokenId) internal view returns (string memory) {
        string memory color = pixelColors[tokenId];
        if (bytes(color).length == 0) {
            color = DEFAULT_COLOR;
        }
        
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" ',
            'viewBox="0 0 100 100" ',
            'preserveAspectRatio="xMidYMid meet">',
            '<rect x="0" y="0" width="100" height="100" fill="', color, '" />',
            '</svg>'
        ));
        
        return string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svg))));
    }

    /**
    * @dev Generate base64 encoded SVG for a composite NFT
    */
    function _generateCompositeImage(uint256 compositeId) internal view returns (string memory) {
        uint256[] memory tokenIds = compositeComponents[compositeId];
        if (tokenIds.length == 0) return "";
        
        (, uint256 minX, uint256 minY, uint256 maxX, uint256 maxY) = this.getCompositionInfo(compositeId);
        
        uint256 width = maxX - minX + 1;
        uint256 height = maxY - minY + 1;
        
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" ',
            'viewBox="0 0 ', Strings.toString(width * 10), ' ', Strings.toString(height * 10), '" ',
            'preserveAspectRatio="xMidYMid meet" style="image-rendering: pixelated;">'
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
        
        return string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svg))));
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