// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract TestPixelNFT1 is ERC721 {
    uint256 public constant WIDTH = 10;
    uint256 public constant HEIGHT = 10;
    mapping(uint256 => string) public pixelColors;

    // Add custom event for color updates
    event ColorUpdated(uint256 indexed tokenId, uint256 indexed x, uint256 indexed y, string color, address owner);

    constructor() ERC721("PixelNFT", "PXNFT") {}

    function _getTokenId(uint256 x, uint256 y) public pure returns (uint256) {
        require(x < WIDTH && y < HEIGHT, "Out of bounds");
        return y * WIDTH + x;
    }

    function mint(uint256 x, uint256 y, string memory color) external {
        uint256 tokenId = _getTokenId(x, y);
        require(!_isMinted(tokenId), "Pixel already owned");
        _mint(msg.sender, tokenId);
        pixelColors[tokenId] = color;
        
        // Emit color update event for minting
        emit ColorUpdated(tokenId, x, y, color, msg.sender);
    }

    function updateColor(uint256 x, uint256 y, string memory color) external {
        uint256 tokenId = _getTokenId(x, y);
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        pixelColors[tokenId] = color;
        
        // Emit color update event
        emit ColorUpdated(tokenId, x, y, color, msg.sender);
    }

    function getColor(uint256 x, uint256 y) external view returns (string memory) {
        uint256 tokenId = _getTokenId(x, y);
        return pixelColors[tokenId];
    }

    function _isMinted(uint256 tokenId) internal view returns (bool) {
        return _existsOwner(tokenId);
    }

    function _existsOwner(uint256 tokenId) internal view returns (bool) {
        try this.ownerOf(tokenId) returns (address owner) {
            return owner != address(0);
        } catch {
            return false;
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_existsOwner(tokenId), "Nonexistent token");

        string memory color = pixelColors[tokenId];
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
}
